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

describe('ETC tactical priorities',()=>{
 it('prioritizes a safe collapse exit over combat, loot and cloud advice',()=>{
  const o=observation();o.self.danger=true;o.actions.push(action('portal',{id:'unsafe',safe:false,distance:1}));
  expect(choose(o,'engage')?.id).toBe('portal');
 });
 it('engages a visible enemy instead of looting',()=>expect(choose(observation())?.kind).toBe('engage'));
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
 it('does not heal in visible enemy fire and preserves a safe ongoing cast',()=>{
  const o=observation();o.self.health=50;o.actions.push(action('heal'));expect(choose(o)?.kind).toBe('engage');
  o.enemies=[];expect(choose(o)?.kind).toBe('heal');o.self.healing=true;expect(choose(o)?.kind).toBe('wait');
 });
 it('blocks firing during spawn protection and all movement during portal travel',()=>{
  const o=observation();o.self.protected=true;expect(choose(o)?.kind).not.toBe('engage');o.self.traveling=true;expect(choose(o)?.kind).toBe('wait');
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
 it('cannot choose a cloud-suggested action outside current affordances',()=>{
  expect(choose(observation(),'teleport_and_win')?.id).toBe('engage');
 });
});

describe('ETC authenticated local transport',()=>{
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
