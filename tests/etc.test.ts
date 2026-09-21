import { describe,it,expect,afterEach,vi } from 'vitest';
import { mkdtemp,readFile,writeFile,rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { performance } from 'node:perf_hooks';
import { EtcBridge } from '../electron/etc-bridge';
import { EtcMetrics,EtcPolicy } from '../electron/etc-policy';
import { EtcAutoplay } from '../electron/etc-autoplay';
import { Game } from '../electron/game';
import { etcObservationSchema,type EtcAction,type EtcObservation } from '../shared/etc';
import { settingsSchema } from '../electron/storage';

const dirs:string[]=[];
afterEach(async()=>{vi.restoreAllMocks();for(const d of dirs.splice(0))await rm(d,{recursive:true,force:true});});
function action(kind:EtcAction['kind'],extra:Partial<EtcAction>={}):EtcAction{return {id:kind,kind,distance:100,safe:true,...extra};}
function observation(extra:Partial<EtcObservation>={}):EtcObservation {
 return {version:3,appId:'5272970',session:'test',matchId:'match-1',timestamp:Date.now(),frame:1,processId:123,
   phase:'playing',mode:'auto',epoch:1,ack:1,foreground:true,map:'L_ETC_Match',
   self:{position:[0,0,0],health:100,maxHealth:100,magazine:20,reserve:40,weapon:'AR01',protected:false,traveling:false,healing:false,room:1,danger:false,evacuationSeconds:-1,kills:0},
   enemies:[{id:'enemy',position:[100,0,0],velocity:[0,0,0],distance:100}],
   actions:[action('wait'),action('scan'),action('engage'),action('loot'),action('portal',{destination:2})],result:null,
   diagnostics:{heldInputs:0,shots:0,stuck:false,observationMs:1,lastAction:''},...extra};
}
function choose(o:EtcObservation,advice?:string){return new EtcPolicy().choose(o,Date.now(),false,true,advice);}
async function bridge(){const d=await mkdtemp(join(tmpdir(),'jev-etc-'));dirs.push(d);return new EtcBridge(d);}

it('timestamps a frame after awaited mailbox work without treating it as a future frame',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'jev-etc-'));dirs.push(directory);let b:EtcBridge;
 b=new EtcBridge(directory,async(file,value)=>{await writeFile(file,value);if(file.endsWith('session.json')){
  await new Promise(r=>setTimeout(r,90));await writeFile(join(directory,'state.json'),JSON.stringify(observation({session:b.session,timestamp:Date.now()})));
 }});
 const started=Date.now(),o=await b.read(123,started);expect(o).not.toBeNull();expect(o!.timestamp-started).toBeGreaterThan(50);
});

describe('ETC tactical priorities',()=>{
 it('evacuates a yellow room ahead of supplies even with only the starter weapon',()=>{
  const p=new EtcPolicy(),o=observation({enemies:[]});o.self.weapon='ID_ETC_StarterPistol_C';o.self.roomType=5;o.self.danger=true;
  o.zone={phase:1,stage:'warning',secondsLeft:140};o.mapView={open:false,revision:1,observedAt:o.timestamp,phase:1,stage:'warning',rooms:[{id:1,number:7,x:0,y:0,w:1,h:1,risk:1,visited:true}],edges:[]};
  o.actions.find(a=>a.kind==='portal')!.destinationRisk=0;
  expect(p.choose(o,o.timestamp,false,true,'portal')?.kind).toBe('portal');
  o.self.health=90;o.timestamp+=50;
  expect(p.choose(o,o.timestamp,false,true,'loot')?.kind).toBe('portal');
  const safe=()=>new EtcPolicy().choose(o,o.timestamp,false,true,'loot')?.kind;
  o.zone.secondsLeft=40;expect(safe()).toBe('portal');o.zone.secondsLeft=140;
  o.mapView.rooms[0].risk=2;expect(safe()).toBe('portal');o.mapView.rooms[0].risk=1;
  o.self.roomType=27;expect(safe()).toBe('portal');o.self.roomType=5;
  o.mapView.observedAt=o.timestamp-15001;expect(safe()).toBe('portal');o.mapView.observedAt=o.timestamp;
  o.self.evacuationSeconds=10;expect(safe()).toBe('portal');o.self.evacuationSeconds=-1;
  o.actions.find(a=>a.kind==='loot')!.distance=1201;expect(safe()).toBe('portal');
 });
 it('prioritizes a safe collapse exit over combat, loot and cloud advice',()=>{
  const o=observation();o.self.danger=true;o.actions.push(action('portal',{id:'unsafe',safe:false,distance:1}));
  expect(choose(o,'engage')?.id).toBe('portal');
 });
 it('engages a visible enemy instead of looting',()=>expect(choose(observation())?.kind).toBe('engage'));
 it('returns fire after damage instead of running across an exposed room for cloud advice',()=>{
  const p=new EtcPolicy(),o=observation(),now=Date.now();
  o.executor={kind:'shared-bot-v1',objective:'portal',status:'running',reason:'accepted',failures:0,pathStatus:3};
  o.actions.find(a=>a.kind==='portal')!.distance=2400;
  p.choose(o,now,false,true,'portal');o.self.health=88;o.timestamp=now+100;
  expect(p.choose(o,o.timestamp,false,true,'portal')?.kind).toBe('engage');
  o.actions.find(a=>a.kind==='portal')!.distance=300;
  expect(p.choose(o,o.timestamp,false,true,'portal')?.kind).toBe('portal');
 });
 it('upgrades a starter loadout before an optional strategic relocation but still evacuates danger',()=>{
  const o=observation({enemies:[]});o.self.weapon='ID_ETC_StarterPistol_C';
  o.executor={kind:'shared-bot-v1',objective:'wait',status:'running',reason:'accepted',failures:0,pathStatus:0};
  expect(choose(o,'portal')?.kind).toBe('loot');
  o.self.danger=true;expect(choose(o,'loot')?.kind).toBe('portal');
 });
 it('keeps airborne steering until landing while foreground loss still stops the command',()=>{
  const p=new EtcPolicy(),o=observation({enemies:[]}),now=Date.now();o.self.grounded=false;
  o.executor={kind:'shared-bot-v1',objective:'portal',status:'running',reason:'accepted',failures:0,pathStatus:3};
  expect(p.choose(o,now,false,true,'loot')?.kind).toBe('portal');
  o.foreground=false;expect(p.choose(o,now,false,true,'loot')?.kind).toBe('wait');
 });
 it('takes cover at low health before exchanging damage',()=>{
  const o=observation();o.self.health=20;o.actions.push(action('cover'));expect(choose(o,'engage')?.kind).toBe('cover');
 });
 it('switches to a loaded secondary instead of firing an empty gun',()=>{
  const o=observation();o.self.magazine=0;o.actions.push(action('reload'),action('equip'));expect(choose(o)?.kind).toBe('equip');
 });
 it('reloads when empty and never manufactures ammo',()=>{
  const o=observation();o.self.magazine=0;o.actions.push(action('reload'));expect(choose(o)?.kind).toBe('reload');
  o.self.reserve=0;expect(choose(o)?.kind).not.toBe('reload');expect(choose(o)?.kind).not.toBe('engage');
 });
 it('does not repeatedly reload a full seven-shell shotgun',()=>{
  const o=observation({enemies:[]});o.self.weapon='SG01';o.self.magazine=7;o.actions.push(action('reload'));
  expect(choose(o)?.kind).not.toBe('reload');
 });
 it('does not heal in visible enemy fire and preserves a safe ongoing cast',()=>{
  const o=observation();o.self.health=50;o.actions.push(action('heal'));expect(choose(o)?.kind).toBe('engage');
  o.enemies=[];expect(choose(o)?.kind).toBe('heal');o.self.healing=true;expect(choose(o)?.kind).toBe('wait');
 });
 it('blocks firing during spawn protection and all movement during portal travel',()=>{
  const o=observation();o.self.protected=true;expect(choose(o)?.kind).not.toBe('engage');o.self.traveling=true;expect(choose(o)?.kind).toBe('wait');
 });
 it('retreats after unseen damage and breaks the interrupted-heal loop',()=>{
  const p=new EtcPolicy(),at=Date.now(),o=observation({enemies:[]});o.actions.push(action('heal'));
  p.choose(o,at,false,true);o.self.health=60;o.self.healing=true;o.timestamp=at+50;
  expect(p.choose(o,at+50,false,true,'scan')?.kind).toBe('portal');
  o.self.healing=false;o.timestamp=at+2000;
  expect(p.choose(o,at+2000,false,true)?.kind).toBe('portal');
  o.self.health=48;o.timestamp=at+4000;
  expect(p.choose(o,at+4000,false,true)?.kind).toBe('portal');
  o.timestamp=at+9100;expect(p.choose(o,at+9100,false,true)?.kind).toBe('heal');
 });
 it('does not treat a disappearing enemy as immediate permission to heal',()=>{
  const p=new EtcPolicy(),at=Date.now(),o=observation();o.self.health=60;o.actions.push(action('heal'));
  p.choose(o,at,false,true);o.enemies=[];o.timestamp=at+100;
  expect(p.choose(o,at+100,false,true)?.kind).not.toBe('heal');
  o.timestamp=at+2100;expect(p.choose(o,at+2100,false,true)?.kind).toBe('heal');
 });
 it.each(['loading','paused','unsupported'] as const)('waits in %s',phase=>expect(choose(observation({phase}))?.kind).toBe('wait'));
 it('waits on stale, future or background observations',()=>{
  expect(choose(observation({timestamp:Date.now()-251}))?.kind).toBe('wait');
  expect(choose(observation({timestamp:Date.now()+1000}))?.kind).toBe('wait');
  expect(choose(observation({foreground:false}))?.kind).toBe('wait');
 });
 it('respects auto-restart after a match and permits the initial start',()=>{
  const p=new EtcPolicy(),o=observation({phase:'ended',result:{placement:2,won:false},actions:[action('wait'),action('new_match')]});
  expect(p.choose(o,Date.now(),false,true)?.kind).toBe('wait');expect(p.choose(o,Date.now(),true,true)?.kind).toBe('new_match');
  o.phase='menu';expect(p.choose(o,Date.now(),false,false)?.kind).toBe('new_match');
 });
 it('waits for the official loss before restarting a dead match',()=>{
  const p=new EtcPolicy(),o=observation({phase:'dead',result:null,actions:[action('wait'),action('new_match')]});
  expect(p.choose(o,Date.now(),true,true)?.kind).toBe('wait');
  o.result={placement:7,won:false};expect(p.choose(o,Date.now(),true,true)?.kind).toBe('new_match');
 });
 it('temporarily avoids a stuck objective and retries after cooldown',()=>{
  const p=new EtcPolicy(),o=observation({enemies:[],actions:[action('wait'),action('scan'),action('portal')]});
  const at=Date.now();expect(p.choose(o,at,false,true)?.kind).toBe('portal');
  o.diagnostics.stuck=true;expect(p.choose(o,at+50,false,true)?.kind).toBe('scan');
  o.diagnostics.stuck=false;o.timestamp=at+5100;expect(p.choose(o,at+5100,false,true)?.kind).toBe('portal');
 });
 it('abandons a route oscillating without net progress, even when native movement is active',()=>{
  const p=new EtcPolicy(),at=Date.now(),o=observation({enemies:[],actions:[action('wait'),action('scan'),action('portal')]});
  o.executor={kind:'shared-bot-v1',objective:'portal',status:'running',reason:'accepted',failures:0,pathStatus:3};
  expect(p.choose(o,at,false,true)?.kind).toBe('portal');
  o.timestamp=at+20001;o.actions.find(a=>a.id==='portal')!.distance=150;
  expect(p.choose(o,o.timestamp,false,true,'portal')?.kind).toBe('scan');
 });
 it('prefers a safe destination and still evacuates through an open warned door when trapped',()=>{
  const o=observation();o.self.danger=true;o.actions.push(action('portal',{id:'warned',distance:10,destinationRisk:2}));
  expect(choose(o)?.id).toBe('portal');o.actions=o.actions.filter(a=>a.id!=='portal');expect(choose(o)?.id).toBe('warned');
 });
 it('cannot choose a cloud-suggested action outside current affordances',()=>{
  expect(choose(observation(),'teleport_and_win')?.id).toBe('engage');
 });
});

describe('ETC authenticated local transport',()=>{
 it('tolerates only a brief Windows replace-file gap within the original freshness and PID limits',async()=>{
  const b=await bridge(),now=Date.now(),file=join(b.directory,'state.json');
  await writeFile(file,JSON.stringify(observation({session:b.session,timestamp:now})));
  expect(await b.read(123,now)).not.toBeNull();await rm(file);
  expect(await b.read(123,now+100)).not.toBeNull();expect(b.lastReadFailure).toBe('ENOENT');
  expect(await b.read(123,now+251)).toBeNull();expect(await b.read(124,now+150)).toBeNull();
 });
 it('can release manual control before the first heartbeat or game selection',async()=>{
  const b=await bridge(),nested=new EtcBridge(join(b.directory,'new-mailbox'));
  await expect(nested.command('manual',1,null)).resolves.toBe(true);
 });
 it('binds telemetry to session, game PID, freshness and increasing frame',async()=>{
  const b=await bridge(),now=Date.now();const o=observation({session:b.session,timestamp:now,frame:10});
  const put=async(v:unknown)=>writeFile(join(b.directory,'state.json'),JSON.stringify(v));
  await put(o);expect(await b.read(123)).toMatchObject({frame:10});
  expect(JSON.parse(await readFile(join(b.directory,'session.json'),'utf8')).processId).toBe(123);
  await put({...o,session:'other'});expect(await b.read(123)).toBeNull();
  await put({...o,timestamp:now-1000});expect(await b.read(123)).toBeNull();
  await put({...o,frame:9});expect(await b.read(123)).toBeNull();
  await put({...o,version:1});expect(await b.read(123)).toBeNull();
  await put(o);expect(await b.read(124)).toBeNull();
 });
 it('accepts a fresh frame sequence only after the observed Steam process changes',async()=>{
  const b=await bridge();await writeFile(join(b.directory,'state.json'),JSON.stringify(observation({session:b.session,frame:100})));
  expect((await b.read(123))?.frame).toBe(100);
  await writeFile(join(b.directory,'state.json'),JSON.stringify(observation({session:b.session,frame:1,processId:124})));
  expect((await b.read(124))?.frame).toBe(1);
 });
 it('rejects malformed state, oversized files and invented result fields',async()=>{
  const b=await bridge();await writeFile(join(b.directory,'state.json'),'x'.repeat(128001));expect(await b.read(123)).toBeNull();
  const o=observation();expect(etcObservationSchema.safeParse({...o,actions:[{id:'killAll',kind:'console'}]}).success).toBe(false);
  expect(etcObservationSchema.safeParse({...o,result:{won:true,placement:0}}).success).toBe(false);
 });
 it('writes bounded leases and excludes the token from observations and summary',async()=>{
  const b=await bridge();await b.heartbeat();const o=observation({session:b.session});await b.command('auto',1,o,'engage');
  const c=JSON.parse(await readFile(join(b.directory,'command.json'),'utf8'));
  expect(c.token).toHaveLength(64);expect(c.matchId).toBe(o.matchId);expect(c.expiresAt-Date.now()).toBeLessThanOrEqual(250);
  expect(c.expiresAt-Date.now()).toBeGreaterThan(0);expect(JSON.stringify(o)).not.toContain(c.token);
 });
 it('serializes manual handover after a pending write and rejects older epochs',async()=>{
  const b=await bridge();await b.heartbeat();const o=observation({session:b.session});
  await Promise.all([b.command('auto',1,o,'engage'),b.command('manual',2,o)]);
  await b.command('auto',1,o,'engage');
  expect(JSON.parse(await readFile(join(b.directory,'command.json'),'utf8'))).toMatchObject({mode:'manual',epoch:2});
 });
 it('closes with release, expires session and rejects subsequent auto commands',async()=>{
  const b=await bridge();await b.heartbeat();await b.close(3);await b.command('auto',4,observation({session:b.session}),'engage');
  expect(JSON.parse(await readFile(join(b.directory,'session.json'),'utf8')).expiresAt).toBe(0);
  expect(JSON.parse(await readFile(join(b.directory,'command.json'),'utf8')).mode).toBe('manual');
 });
});

describe('ETC evaluation truthfulness and independent control',()=>{
 it('does not issue an automatic decision when manual takeover happens during reauthorization',async()=>{
  const game=new Game({directory:'.',settings:async()=>settingsSchema.parse({})} as any,()=>{}, {games:[]} as any,'unused');
  (game as any).selectedId='5272970';game.observation={connected:true,timestamp:Date.now(),processId:123};game.gate.change('auto');
  (game as any).reconnectUntil=Date.now()+1000;(game as any).reconnectMatch='match-1';
  vi.spyOn(game.autoplay,'observe').mockResolvedValue(observation({mode:'manual'}));
  let release!:()=>void,started!:()=>void;const pending=new Promise<void>(r=>release=r),ready=new Promise<void>(r=>started=r);
  vi.spyOn(game.autoplay,'resumeControl').mockImplementation(()=>{started();return pending;});
  vi.spyOn(game.autoplay,'change').mockResolvedValue();const decide=vi.spyOn(game.autoplay,'tick').mockResolvedValue();
  const running=(game as any).tick();await ready;await game.setMode('manual');release();await running;
  expect(game.gate.mode).toBe('manual');expect(decide).not.toHaveBeenCalled();
 });
 it('pauses commands during a brief game-frame stall and requires fresh same-match telemetry to resume',async()=>{
  const game=new Game({directory:'.',settings:async()=>settingsSchema.parse({})} as any,()=>{}, {games:[]} as any,'unused');
  (game as any).selectedId='5272970';game.observation={connected:true,foreground:true,timestamp:Date.now(),processId:123};game.gate.change('auto');
  game.autoplay.observation=observation();game.autoplay.bridge.lastReadFailure='age';
  const observe=vi.spyOn(game.autoplay,'observe').mockResolvedValue(null),tick=vi.spyOn(game.autoplay,'tick').mockResolvedValue(),resume=vi.spyOn(game.autoplay,'resumeControl').mockResolvedValue();
  vi.spyOn(game.autoplay,'change').mockResolvedValue();
  await (game as any).tick();expect(game.gate.mode).toBe('auto');expect(tick).not.toHaveBeenCalled();
  observe.mockResolvedValue(observation({mode:'manual'}));await (game as any).tick();expect(resume).toHaveBeenCalledWith(2);
  expect(game.gate.mode).toBe('auto');expect((game as any).reconnectUntil).toBe(0);
 });
 it('uses the clock after an asynchronous read when evaluating a confirmed lease stop',async()=>{
  let clock=Date.now();vi.spyOn(Date,'now').mockImplementation(()=>clock);
  const game=new Game({directory:'.',settings:async()=>settingsSchema.parse({})} as any,()=>{}, {games:[]} as any,'unused');
  (game as any).selectedId='5272970';game.observation={connected:true,foreground:true,timestamp:clock,processId:123};game.gate.change('auto');
  const o=observation();o.executor={kind:'shared-bot-v1',objective:'scan',status:'running',reason:'accepted',failures:0,pathStatus:0};
  game.autoplay.recovery.poll(o,1,clock);
  vi.spyOn(game.autoplay,'observe').mockImplementation(async()=>{clock+=120;return {...o,frame:2,timestamp:clock,mode:'manual',executor:{...o.executor!,status:'released',reason:'lease_expired'}};});
  vi.spyOn(game.autoplay,'change').mockResolvedValue();const decide=vi.spyOn(game.autoplay,'tick').mockResolvedValue();
  await (game as any).tick();expect(game.gate.mode).toBe('auto');expect(decide).not.toHaveBeenCalled();
 });
 it('never resumes a long stall, invalid identity, focus loss or explicit manual takeover',async()=>{
  for(const failure of ['timeout','identity','focus','manual']){
   const game=new Game({directory:'.',settings:async()=>settingsSchema.parse({})} as any,()=>{}, {games:[]} as any,'unused');
   (game as any).selectedId='5272970';game.observation={connected:true,foreground:true,timestamp:Date.now(),processId:123};game.gate.change('auto');
   game.autoplay.observation=observation();game.autoplay.bridge.lastReadFailure='age';
   const observe=vi.spyOn(game.autoplay,'observe').mockResolvedValue(null),resume=vi.spyOn(game.autoplay,'resumeControl').mockResolvedValue();
   vi.spyOn(game.autoplay.bridge,'command').mockResolvedValue(true);
   await (game as any).tick();
   if(failure==='timeout')(game as any).reconnectUntil=Date.now()-1;
   if(failure==='identity')game.autoplay.bridge.lastReadFailure='identity';
   if(failure==='focus')observe.mockResolvedValue(observation({foreground:false}));
   if(failure==='manual')await game.setMode('manual');
   await (game as any).tick();expect(game.gate.mode).toBe('manual');expect(resume).not.toHaveBeenCalled();
  }
 });
 it('recovers an observed portal journey with a new lease without weakening normal stale-state protection',async()=>{
  const game=new Game({directory:'.',settings:async()=>settingsSchema.parse({})} as any,()=>{}, {games:[]} as any,'unused');
  (game as any).selectedId='5272970';game.observation={connected:true,timestamp:Date.now(),processId:123};game.gate.change('auto');
  game.autoplay.strategy='portal';const traveling=observation();traveling.self.traveling=true;
  const observe=vi.spyOn(game.autoplay,'observe').mockResolvedValue(traveling);
  const resume=vi.spyOn(game.autoplay,'resumeControl').mockResolvedValue();vi.spyOn(game.autoplay,'tick').mockResolvedValue();vi.spyOn(game.autoplay,'change').mockResolvedValue();
  await (game as any).tick();observe.mockResolvedValue(null);await (game as any).tick();expect(game.gate.mode).toBe('auto');
  const arrived=observation({mode:'manual'});arrived.self.room=2;observe.mockResolvedValue(arrived);
  await (game as any).tick();expect(resume).toHaveBeenCalledWith(2);expect(game.gate.mode).toBe('auto');
  observe.mockResolvedValue(null);await (game as any).tick();expect(game.gate.mode).toBe('manual');
 });
 it('does not resume a portal journey after manual takeover or loss of foreground',async()=>{
  const game=new Game({directory:'.',settings:async()=>settingsSchema.parse({})} as any,()=>{}, {games:[]} as any,'unused');
  (game as any).selectedId='5272970';game.observation={connected:true,timestamp:Date.now(),processId:123};game.gate.change('auto');game.autoplay.strategy='portal';
  const o=observation();o.self.traveling=true;const observe=vi.spyOn(game.autoplay,'observe').mockResolvedValue(o);
  vi.spyOn(game.autoplay.bridge,'command').mockResolvedValue(true);const resume=vi.spyOn(game.autoplay,'resumeControl').mockResolvedValue();
  await (game as any).tick();observe.mockResolvedValue({...o,foreground:false});await (game as any).tick();
  expect(game.gate.mode).toBe('manual');expect((game as any).portalUntil).toBe(0);expect(resume).not.toHaveBeenCalled();
 });
 it('keeps a requested match loading grace through world replacement and rearms only after drop-in',async()=>{
  const game=new Game({directory:'.',settings:async()=>settingsSchema.parse({})} as any,()=>{}, {games:[]} as any,'unused');
  (game as any).selectedId='5272970';game.observation={connected:true,timestamp:Date.now(),processId:123};
  game.gate.change('auto');game.autoplay.transitionMatch='menu';game.autoplay.transitionUntil=Date.now()+120000;
  const observe=vi.spyOn(game.autoplay,'observe');const change=vi.spyOn(game.autoplay,'change').mockResolvedValue();
  const tick=vi.spyOn(game.autoplay,'tick').mockResolvedValue();
  observe.mockResolvedValue(observation({phase:'loading',mode:'manual',epoch:game.gate.epoch}));
  await (game as any).tick();expect(game.gate.mode).toBe('auto');expect(game.autoplay.transitionUntil).toBeGreaterThan(Date.now());expect(change).not.toHaveBeenCalled();expect(tick).not.toHaveBeenCalled();
  observe.mockResolvedValue(null);await (game as any).tick();expect(game.gate.mode).toBe('auto');
  observe.mockResolvedValue(observation({phase:'playing',mode:'manual',epoch:game.gate.epoch}));
  await (game as any).tick();expect(game.autoplay.transitionUntil).toBe(0);expect(change).toHaveBeenCalledWith('auto',game.gate.epoch);expect(tick).toHaveBeenCalledTimes(1);
  observe.mockResolvedValue(null);await (game as any).tick();expect(game.gate.mode).toBe('manual');
 });
 it('retries a pending start on a still-visible lobby instead of blocking it behind loading grace',async()=>{
  const game=new Game({directory:'.',settings:async()=>settingsSchema.parse({autoRestart:true})} as any,()=>{}, {games:[]} as any,'unused');
  (game as any).selectedId='5272970';game.observation={connected:true,timestamp:Date.now(),processId:123};game.gate.change('auto');
  game.autoplay.transitionMatch='match-1';game.autoplay.transitionUntil=Date.now()+120000;
  vi.spyOn(game.autoplay,'observe').mockResolvedValue(observation({phase:'menu'}));
  const tick=vi.spyOn(game.autoplay,'tick').mockResolvedValue();
  await (game as any).tick();expect(tick).toHaveBeenCalledOnce();expect(game.gate.mode).toBe('auto');
 });
 it('never rearms a native manual takeover during a pending rematch',async()=>{
  const game=new Game({directory:'.',settings:async()=>settingsSchema.parse({autoRestart:true})} as any,()=>{}, {games:[]} as any,'unused');
  (game as any).selectedId='5272970';game.observation={connected:true,timestamp:Date.now(),processId:123};game.gate.change('auto');
  game.autoplay.transitionMatch='match-1';game.autoplay.transitionUntil=Date.now()+120000;
  vi.spyOn(game.autoplay,'observe').mockResolvedValue(observation({phase:'menu',mode:'manual',executor:{kind:'shared-bot-v1',status:'released',reason:'manual_takeover',objective:'',failures:0,pathStatus:0}}));
  vi.spyOn(game.autoplay.bridge,'command').mockResolvedValue(true);const resume=vi.spyOn(game.autoplay,'resumeControl').mockResolvedValue();
  await (game as any).tick();expect(game.gate.mode).toBe('manual');expect(resume).not.toHaveBeenCalled();
 });
 it('starts immediately after a result, retries within five seconds, and starts a fresh lobby without inherited cooldown',async()=>{
  let now=Date.now();vi.spyOn(Date,'now').mockImplementation(()=>now);
  const b=await bridge(),runner=new EtcAutoplay(b,{get:vi.fn()} as any),commands=vi.spyOn(b,'command').mockResolvedValue(true);
  const settings=settingsSchema.parse({decisionProvider:'rules',autoRestart:true});
  runner.observation=observation();await runner.change('auto',1);await runner.tick(settings,1);commands.mockClear();
  const next=async(extra:Partial<EtcObservation>,ms:number)=>{now+=ms;runner.observation=observation({...extra,timestamp:now,frame:runner.observation!.frame+1});await runner.tick(settings,1);};
  const result={phase:'ended' as const,result:{placement:1,won:true},actions:[action('wait'),action('new_match')]};
  await next(result,50);expect(commands.mock.calls.at(-1)?.[3]).toBe('new_match');
  await next(result,50);expect(commands).toHaveBeenCalledTimes(1);
  await next(result,1450);expect(commands).toHaveBeenCalledTimes(2);
  await next({phase:'menu',matchId:'lobby-next',actions:result.actions},50);expect(commands).toHaveBeenCalledTimes(3);
  await next({phase:'dead',matchId:'round-next',result:null,actions:result.actions},50);expect(commands.mock.calls.at(-1)?.[3]).toBe('wait');
 });
 it('uses the visible room-pick screen during an authorized loading transition without dropping the grace',async()=>{
  const game=new Game({directory:'.',settings:async()=>settingsSchema.parse({})} as any,()=>{}, {games:[]} as any,'unused');
  (game as any).selectedId='5272970';game.observation={connected:true,timestamp:Date.now(),processId:123};
  game.gate.change('auto');game.autoplay.transitionMatch='menu';game.autoplay.transitionUntil=Date.now()+120000;
  const o=observation({phase:'loading',mode:'manual',epoch:game.gate.epoch,roomPick:{locked:-1,secondsLeft:8,rooms:[{id:0,exits:2,loot:4,hotspot:false}]}});
  vi.spyOn(game.autoplay,'observe').mockResolvedValue(o);const resume=vi.spyOn(game.autoplay,'resumeControl').mockResolvedValue();const tick=vi.spyOn(game.autoplay,'tick').mockResolvedValue();
  await (game as any).tick();expect(resume).toHaveBeenCalledOnce();expect(tick).toHaveBeenCalledOnce();expect(game.autoplay.transitionUntil).toBeGreaterThan(Date.now());
  vi.spyOn(game.autoplay.bridge,'command').mockResolvedValue(true);await game.setMode('manual');await (game as any).tick();expect(tick).toHaveBeenCalledOnce();
 });
 it('manual takeover during loading cancels automatic rearming',async()=>{
  const game=new Game({directory:'.',settings:async()=>settingsSchema.parse({})} as any,()=>{}, {games:[]} as any,'unused');
  game.gate.change('auto');game.autoplay.transitionUntil=Date.now()+120000;
  vi.spyOn(game.autoplay.bridge,'command').mockResolvedValue(true);
  await game.setMode('manual');expect(game.autoplay.transitionUntil).toBe(0);expect(game.gate.mode).toBe('manual');
 });
 it('manual takeover cancels an automatic-enable request still awaiting telemetry',async()=>{
  const game=new Game({directory:'.',settings:async()=>settingsSchema.parse({})} as any,()=>{}, {games:[]} as any,'unused');
  (game as any).selectedId='5272970';game.observation={connected:true,timestamp:Date.now(),processId:123};
  let resolve!:(o:EtcObservation)=>void;const pending=new Promise<EtcObservation>(r=>{resolve=r;});
  vi.spyOn(game.autoplay,'observe').mockReturnValue(pending);
  vi.spyOn(game.autoplay,'change').mockResolvedValue();
  const enabling=game.setMode('auto');await game.setMode('manual');resolve(observation());await enabling;
  expect(game.gate.mode).toBe('manual');expect(game.autoplay.change).toHaveBeenCalledTimes(1);
 });
 it('counts authoritative results once and records interrupted matches separately',()=>{
  const m=new EtcMetrics(),o=observation();m.observe(o);
  m.observe({...o,frame:2,phase:'ended',result:{placement:1,won:true}});m.observe({...o,frame:3,phase:'ended',result:{placement:1,won:true}});
  expect(m.matches).toBe(1);expect(m.wins).toBe(1);
  m.observe({...o,frame:4,matchId:'two'});m.observe({...o,frame:5,matchId:'three'});
  expect(m.interrupted).toBe(1);expect(m.matches).toBe(1);
  m.observe({...o,frame:6,matchId:'three',phase:'dead',result:{placement:5,won:false}});expect(m.losses).toBe(1);expect(m.lastPlacement).toBe(5);
 });
 it('does not count a menu or inherited result as a played win',()=>{
  const m=new EtcMetrics();m.observe(observation({phase:'ended',result:{placement:1,won:true}}));expect(m.matches).toBe(0);
 });
 it('excludes mixed manual/automatic matches from autonomous win rate',()=>{
  const m=new EtcMetrics(),o=observation();m.observe(o,true);m.observe({...o,frame:2},false);
  m.observe({...o,frame:3,phase:'ended',result:{placement:1,won:true}},true);
  expect(m.wins).toBe(0);expect(m.matches).toBe(0);expect(m.interrupted).toBe(1);
 });
 it('runs local decisions with no OBS, broadcasting, cloud key or network dependency',async()=>{
  const b=await bridge();await b.heartbeat();const store:any={get:vi.fn(()=>{throw new Error('key should not be read');})};
  const runner=new EtcAutoplay(b,store);runner.observation=observation({session:b.session});await runner.change('auto',10);
  await runner.tick(settingsSchema.parse({decisionProvider:'rules'}),10);
  expect(JSON.parse(await readFile(join(b.directory,'command.json'),'utf8')).action).toBe('engage');expect(store.get).not.toHaveBeenCalled();
  expect(runner.summary.decisions).toBe(1);await runner.tick(settingsSchema.parse({}),10);expect(runner.summary.decisions).toBe(1);
 });
 it('benchmarks policy CPU cost separately from end-to-end latency and win rate',()=>{
  const p=new EtcPolicy(),o=observation(),start=performance.now();
  for(let i=0;i<10000;i++)p.choose(o,o.timestamp,false,true);
  const elapsed=performance.now()-start;
  expect(elapsed).toBeLessThan(2000); // < 0.2 ms average is a generous regression guard.
  const m=new EtcMetrics();m.decision(1000,1040);m.decision(2000,2080);expect(m.p95LatencyMs).toBe(80);expect(m.matches).toBe(0);
 });
});
