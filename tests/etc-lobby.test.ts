import {afterEach,it,expect,vi} from 'vitest';
import {Game} from '../electron/game';
import {settingsSchema} from '../electron/storage';
import type {EtcObservation} from '../shared/etc';

afterEach(()=>vi.restoreAllMocks());
function setup(){
 let now=100000;vi.spyOn(Date,'now').mockImplementation(()=>now);
 const settings=settingsSchema.parse({autoRestart:true,decisionProvider:'rules'});
 const game=new Game({directory:'.',settings:async()=>settings} as any,()=>{}, {games:[]} as any,'unused');
 (game as any).selectedId='5272970';game.gate.change('auto');
 const o={version:3,appId:'5272970',session:'s',matchId:'m',timestamp:now,frame:1,processId:123,phase:'ended',mode:'auto',epoch:1,ack:1,foreground:true,map:'L_ETC_Match',
  self:{position:[0,0,0],health:0,maxHealth:100,magazine:0,reserve:0,weapon:'',protected:false,traveling:false,healing:false,room:1,danger:false,evacuationSeconds:0,kills:1},
  result:{placement:2,won:false},enemies:[],actions:[{id:'wait',kind:'wait',distance:0,safe:true},{id:'new_match',kind:'new_match',distance:0,safe:true}],diagnostics:{heldInputs:0,shots:5,stuck:false,observationMs:0,lastAction:''},
  executor:{kind:'shared-bot-v1',objective:'',status:'released',reason:'pawn_unavailable',failures:0,pathStatus:0}} as EtcObservation;
 game.observation={connected:true,timestamp:now,foreground:true,processId:123,lobbyReturn:{observedAt:now}};
 const send=vi.spyOn(game as any,'send').mockImplementation(()=>{}),decide=vi.spyOn(game.autoplay,'tick').mockResolvedValue();
 const change=vi.spyOn(game.autoplay,'change').mockResolvedValue(),resume=vi.spyOn(game.autoplay,'resumeControl').mockResolvedValue();
 vi.spyOn(game.autoplay,'observe').mockImplementation(async()=>o);
 const tick=async(ms=50)=>{now+=ms;o.timestamp=now;o.frame++;if(game.observation){game.observation.timestamp=now;if(game.observation.lobbyReturn)game.observation.lobbyReturn.observedAt=now;}await (game as any).tick();};
 return {game,o,settings,send,decide,change,resume,tick};
}
it.each([0,.5,.999999])('waits a single sampled 5–8 second lobby delay after returning, random=%s',async random=>{
 vi.spyOn(Math,'random').mockReturnValue(random);
 const {game,o,send,decide,change,tick}=setup();
 await tick();expect(send).toHaveBeenCalledWith({op:'return_lobby',epoch:1,processId:123,observedAt:o.timestamp});expect(decide).not.toHaveBeenCalled();
 await tick();expect(send).toHaveBeenCalledOnce();await tick(1450);expect(send).toHaveBeenCalledTimes(2);
 o.phase='loading';o.matchId='lobby';await tick();expect(decide).not.toHaveBeenCalled();
 o.phase='menu';o.mode='manual';o.result=null;await tick();expect(change).not.toHaveBeenCalled();
 const delay=5000+Math.floor(random*3001);await tick(delay-1);expect(change).not.toHaveBeenCalled();expect(decide).not.toHaveBeenCalled();
 await tick(1);expect(change).toHaveBeenCalledWith('auto',2);expect(decide).not.toHaveBeenCalled();
 o.mode='auto';o.epoch=game.gate.epoch;game.observation!.botMatch={observedAt:o.timestamp};await tick();
 expect(decide).not.toHaveBeenCalled();expect(send).toHaveBeenLastCalledWith(expect.objectContaining({op:'bot_match',epoch:2}));
});
it('manual control cancels a lobby countdown and never starts a match later',async()=>{
 const {game,o,change,decide,tick}=setup();await tick();o.phase='menu';o.result=null;await tick();
 await game.setMode('manual');change.mockClear();await tick(9000);expect(change).not.toHaveBeenCalled();expect(decide).not.toHaveBeenCalled();
});
it('keeps returning after a confirmed result even if lingering healing reports playing again',async()=>{
 const {game,o,send,decide,resume,tick}=setup();game.observation!.lobbyReturn=null;
 await tick();expect(send).not.toHaveBeenCalled();
 // Actual Steam observation: gauze ticks after elimination, HP becomes 2,
 // phase flips to playing and result is null before the menu transition.
 o.phase='playing';o.result=null;o.self.health=2;o.mode='manual';o.executor!.reason='lease_expired';
 game.observation!.lobbyReturn={observedAt:o.timestamp};await tick(1600);
 expect(send).toHaveBeenCalledWith(expect.objectContaining({op:'return_lobby',epoch:1,processId:123}));
 expect(decide).not.toHaveBeenCalled();expect(resume).not.toHaveBeenCalled();
 send.mockClear();game.observation!.lobbyReturn=null;await tick(1600);expect(send).not.toHaveBeenCalled();
});
it.each(['missing','wrongPid','background','captureError','noResult'] as const)('does not guess a result button after %s',fault=>{
 const {game,o,send,decide,tick}=setup();
 if(fault==='missing')game.observation!.lobbyReturn=null;
 if(fault==='wrongPid')game.observation!.processId=456;
 if(fault==='background')game.observation!.foreground=false;
 if(fault==='captureError')game.observation!.error='capture_unavailable';
 if(fault==='noResult')o.result=null;
 return tick().then(()=>{expect(send).not.toHaveBeenCalled();if(fault!=='noResult')expect(decide).not.toHaveBeenCalled();});
});
it('explicit manual handover cancels a pending lobby return and future clicks',async()=>{
 const {game,send,decide,tick}=setup();await tick();await game.setMode('manual');send.mockClear();await tick(2000);
 expect(send).not.toHaveBeenCalled();expect(decide).not.toHaveBeenCalled();expect(game.gate.mode).toBe('manual');
});
it('does not recover an unrequested native manual takeover on the result screen',async()=>{
 const {game,o,send,decide,tick}=setup();o.mode='manual';o.executor!.reason='manual_takeover';await tick();
 expect(game.gate.mode).toBe('manual');expect(send.mock.calls.some(([c])=>(c as any).op==='return_lobby')).toBe(false);expect(decide).not.toHaveBeenCalled();
});
it.each(['focus_lost','not_started'])('focus loss pauses automatic intent and returns to lobby after a result with %s',async reason=>{
 const {game,o,send,resume,tick}=setup();o.phase='playing';o.result=null;o.foreground=false;
 await tick();expect(game.gate.mode).toBe('auto');expect(send).not.toHaveBeenCalled();
 o.phase='ended';o.result={placement:2,won:false};o.foreground=true;o.mode='manual';o.executor!.reason=reason;
 for(let i=0;i<4;i++)await tick(250);
 expect(resume).toHaveBeenCalledWith(2);expect(send).not.toHaveBeenCalled();
 o.epoch=2;o.mode='auto';await tick();expect(send).toHaveBeenCalledWith(expect.objectContaining({op:'return_lobby',epoch:2}));
});
it('stops safely if an attempted lobby navigation times out or the game process changes',async()=>{
 for(const fault of ['timeout','identity']){
  const {game,o,send,tick}=setup();await tick();send.mockClear();
  if(fault==='identity')o.processId=456;await tick(fault==='timeout'?30001:50);
  expect(game.gate.mode).toBe('manual');expect(send.mock.calls.some(([c])=>(c as any).op==='return_lobby')).toBe(false);
 }
});
it('retains automatic return when the native death overlay is absent for over thirty seconds',async()=>{
 const {game,o,send,decide,resume,tick}=setup();game.observation!.lobbyReturn=null;
 await tick();await tick(31000);await tick(31000);
 expect(game.gate.mode).toBe('auto');expect(send).not.toHaveBeenCalled();expect(decide).not.toHaveBeenCalled();expect(resume).not.toHaveBeenCalled();
 o.phase='ended';game.observation!.lobbyReturn={observedAt:o.timestamp};await tick();
 expect(send).toHaveBeenCalledWith(expect.objectContaining({op:'return_lobby'}));
 o.phase='menu';o.result=null;await tick();expect((game as any).lobbyReadyAt-o.timestamp).toBeGreaterThanOrEqual(5000);
 await tick(8000);expect(game.autoplay.change).toHaveBeenCalledWith('auto',2);
});
it.each(['match','epoch','stale','noResult','manualTakeover'] as const)('does not extend a missing-button wait after %s',fault=>{
 const {game,o,send,tick}=setup();game.observation!.lobbyReturn=null;
 return tick().then(async()=>{
  if(fault==='match')o.matchId='other';if(fault==='epoch')o.epoch++;
  if(fault==='noResult')o.result=null;if(fault==='manualTakeover'){o.mode='manual';o.executor!.reason='manual_takeover';}
  if(fault==='stale')vi.spyOn(game.autoplay,'observe').mockImplementation(async()=>({...o,timestamp:o.timestamp-1000}));
  await tick(31000);expect(game.gate.mode).toBe('manual');expect(send.mock.calls.some(([c])=>(c as any).op==='return_lobby')).toBe(false);
 });
});
it('excludes time spent unfocused from the lobby return timeout',async()=>{
 const {game,o,send,resume,tick}=setup();await tick();
 o.foreground=false;await tick();o.mode='manual';o.executor!.reason='focus_lost';await tick(60000);
 expect(game.gate.mode).toBe('auto');o.foreground=true;
 for(let i=0;i<4;i++)await tick(250);
 expect(resume).toHaveBeenCalledOnce();send.mockClear();o.mode='auto';o.epoch=game.gate.epoch;await tick();
 expect(send).toHaveBeenCalledWith(expect.objectContaining({op:'return_lobby'}));expect(game.gate.mode).toBe('auto');
});

it('retains an explicit background Auto request until focus returns, then continues through lobby',async()=>{
 const {game,o,send,resume,decide,tick}=setup();o.foreground=false;o.mode='manual';o.epoch=0;o.ack=0;o.executor!.reason='manual_takeover';
 game.observation!.foreground=false;
 await game.setMode('auto');send.mockClear();await tick(60000);
 expect(game.gate.mode).toBe('auto');expect(send).not.toHaveBeenCalled();expect(decide).not.toHaveBeenCalled();
 game.observation!.foreground=true;o.foreground=true;
 for(let i=0;i<4;i++)await tick(250);
 expect(resume).toHaveBeenCalledWith(3);expect(send).not.toHaveBeenCalled();
 o.epoch=game.gate.epoch;o.mode='auto';o.executor!.reason='accepted';await tick();
 expect(send).toHaveBeenCalledWith(expect.objectContaining({op:'return_lobby',epoch:3}));
});
