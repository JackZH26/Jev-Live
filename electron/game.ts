import { message, type MessageKey } from '../shared/i18n';
import { access } from 'node:fs/promises';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createInterface } from 'node:readline';
import { join } from 'node:path';
import { EtcAutoplay } from './etc-autoplay';
import { EtcBridge } from './etc-bridge';
import { ETC_APP_ID } from '../shared/etc';
import { Store } from './storage';
import { Steam } from './steam';
import type { GameState, PlayMode, GameAction } from '../shared/types';

export class ControlGate {
 mode:PlayMode='manual'; epoch=0;
 change(mode:PlayMode){this.mode=mode;return ++this.epoch;}
 permits(epoch:number,observedAt:number,now=Date.now()){return this.mode==='auto'&&epoch===this.epoch&&now-observedAt<2500&&observedAt<=now+500;}
}
export interface ScreenLine {text:string;x:number;y:number;width:number;height:number}
export interface Observation {connected:boolean;timestamp:number;processId?:number;foreground?:boolean;lines?:ScreenLine[];error?:string;ocrAvailable?:boolean;actionCount?:number;lastAction?:string;heldInputs?:number;controlMode?:PlayMode}
export interface ScreenAction extends GameAction {x?:number;y?:number}
/** Candidate menus come only from recognized text; never click guessed screen coordinates. */
export function screenActions(observation:Observation,autoRestart:boolean):{phase:string;actions:ScreenAction[]} {
 const lines=observation.lines??[],text=lines.map(l=>l.text).join(' ').toLowerCase();
 const wait={id:'wait',kind:'wait',label:'Wait and observe without pressing any keys'};
 if(observation.error||observation.ocrAvailable===false)return {phase:observation.error==='minimized'?'paused':'loading',actions:[wait]};
 const ended=/eliminated|spectating|match results|game over|victory|defeat|淘汰|观战|結算|结算/i.test(text)||lines.some(l=>/^(return to lobby|back to lobby|返回大厅)$/i.test(l.text.trim()));
 const menus=lines.filter(l=>/^(bot match|practice|training|return to lobby|back to lobby|play again|人机对战|返回大厅)$/i.test(l.text.trim()));
 if(menus.length && (!ended||autoRestart))return {phase:ended?'ended':'menu',actions:[wait,...menus.map((l,i)=>({id:`menu-${i}`,kind:'menu',label:`Click the visible game button: ${l.text}`,x:l.x+l.width/2,y:l.y+l.height/2}))]};
 if(ended)return {phase:'ended',actions:[wait]};
 // Unknown UI stays idle; a gameplay HUD must be observed before movement starts.
 const playing=!/characters|armory|match making/i.test(text)&&(/health|shield|ammo|players|remaining|kills|damage|生存|生命|护盾|玩家|剩余|击杀|round|room|zone/i.test(text)||/\d+\s*\/\s*\d+/.test(text));
 if(!playing)return {phase:'loading',actions:[wait]};
 const kinds=['forward','back','left','right','reload','interact','jump','shoot'] as const;
 return {phase:'playing',actions:[wait,...kinds.map(kind=>({id:kind,kind,label:({forward:'Explore forward briefly',back:'Move back briefly',left:'Turn camera left',right:'Turn camera right',reload:'Reload weapon',interact:'Interact with a nearby object',jump:'Jump over a low obstacle',shoot:'Fire briefly in the current camera direction'} as const)[kind]}))]};
}
export class Game {
 readonly gate=new ControlGate();state:GameState|null=null;error='';decision=message('game.notStarted');
 observation:Observation|null=null;
 readonly autoplay:EtcAutoplay;
 private process?:ChildProcessWithoutNullStreams;private timer?:NodeJS.Timeout;
 private inFlight=false;private selectedId='';private settingsAt=0;private focusUntil=0;private modeRequest=0;private settingsCache?:Awaited<ReturnType<Store['settings']>>;
 private portalUntil=0;private portalMatch='';private portalRoom=-1;
 private reconnectUntil=0;private reconnectMatch='';
 constructor(private store:Store,private log:(text:string)=>void,readonly steam:Steam,private helper:string){
  const bridgeDirectory=process.env.JEV_TEST_DATA_DIR&&process.env.JEV_TEST_ETC_BRIDGE_DIR
   ?process.env.JEV_TEST_ETC_BRIDGE_DIR:join(process.env.LOCALAPPDATA??store.directory,'JevLive','etc-bridge');
  this.autoplay=new EtcAutoplay(new EtcBridge(bridgeDirectory),store);
 }
 get decisionStats(){return this.autoplay.stats;}
 get connected(){return !!this.observation?.connected&&Date.now()-this.observation.timestamp<3000;}
 get pid(){return this.observation?.processId;}
 get selected(){return this.steam.games.find(g=>g.appId===this.selectedId)??null;}
 async init(){await this.steam.scan().catch(()=>{});this.selectedId=(await this.store.settings()).steamAppId;this.gate.epoch=Date.now();if(this.selected)await this.observe().catch(()=>{this.error=message('error.desktopHelper');});this.timer=setInterval(()=>{void this.tick().catch(async()=>{this.error=message('error.gameRead');if(this.gate.mode==='auto')await this.setMode('manual').catch(()=>{});});},50);}
 private send(value:unknown){if(this.process?.stdin.writable)this.process.stdin.write(JSON.stringify(value)+'\n');}
 async select(appId:string){await this.setMode('manual');await this.detach();this.selectedId=appId;this.state=null;this.observation=null;this.autoplay.observation=null;this.error='';this.decision=message('game.notStarted');if(appId)await this.observe();}
 private async observe(){
  const game=this.selected;if(!game)return;await access(this.helper);
  this.process=spawn(this.helper,[game.installDirectory],{windowsHide:true,stdio:'pipe'});
  const child=this.process;child.on('error',()=>{this.error=message('error.desktopHelper');});child.stdin.on('error',()=>{});
  createInterface({input:child.stdout}).on('line',line=>{if(line.length>100000||child!==this.process)return;try{const o=JSON.parse(line);if(o.type==='observation'&&typeof o.timestamp==='number')this.observation=o;}catch{}});
  child.on('exit',()=>{if(child===this.process){void this.setMode('manual').catch(()=>{});this.observation=null;this.process=undefined;}});
 }
 async launch(){if(!this.selected)throw new Error(message('error.steamSelection'));if(!this.process)await this.observe();if(this.selectedId===ETC_APP_ID)await this.autoplay.bridge.heartbeat();await this.steam.launch(this.selected.appId);this.log(message('event.steamLaunched',{name:this.selected.name}));}
 async setMode(mode:PlayMode){
  const request=++this.modeRequest;
  if(mode==='auto'){
   if(this.selectedId!==ETC_APP_ID)throw new Error(message('error.autoUnsupported'));
   if(!this.connected)throw new Error(message('error.gameFirst'));
   const o=await this.autoplay.observe(this.pid,this.gate.mode==='auto');
   if(!o)throw new Error(message('etc.unavailable'));
   if(o.phase==='unsupported')throw new Error(message('etc.offlineOnly'));
   if((await this.store.settings()).decisionProvider==='jev'&&!await this.store.get('jev.key'))throw new Error(message('error.jevKey'));
  }
  if(request!==this.modeRequest)return;
  const epoch=this.gate.change(mode);
  if(mode==='manual'){this.portalUntil=0;this.reconnectUntil=0;}
  // SteamObserver remains an observer. ETC owns all gameplay input.
  this.send({op:'stop',epoch});
  this.focusUntil=mode==='auto'?Date.now()+1000:0;
  if(mode==='auto')this.send({op:'focus'});
  await this.autoplay.change(mode,epoch);
  if(request!==this.modeRequest)return;
  this.decision=message(mode==='auto'?'game.nextDecision':'game.playerControl');this.error='';this.log(message(mode==='auto'?'event.auto':'event.manual'));
 }
 private async tick(){
  if(this.inFlight)return;this.inFlight=true;
  try{
   const now=Date.now();if(!this.settingsCache||now-this.settingsAt>500){this.settingsCache=await this.store.settings();this.settingsAt=now;}
   const settings=this.settingsCache;
   if(this.selectedId!==ETC_APP_ID)return;
   const previous=this.autoplay.observation;
   const o=await this.autoplay.observe(this.connected?this.pid:undefined,this.gate.mode==='auto');
   if(!o){
    if(this.gate.mode==='auto'&&(now<this.autoplay.transitionUntil||now<this.portalUntil)){this.state=null;return;}
    const transient=['age','ENOENT','EACCES','EPERM','EBUSY'].includes(this.autoplay.bridge.lastReadFailure);
    if(this.gate.mode==='auto'&&transient&&this.connected&&this.observation?.foreground===true){
     if(!this.reconnectUntil&&previous?.phase==='playing'&&previous.foreground){this.reconnectUntil=now+1000;this.reconnectMatch=previous.matchId;}
     // No stale command is sent. Native input still expires after 250 ms.
     if(now<this.reconnectUntil){this.state=null;return;}
    }
    if(this.gate.mode==='auto'){await this.setMode('manual');this.error=message('etc.lost');}
    else if(this.connected)this.decision=message('etc.unavailable');
    this.state=null;return;
   }
   this.state={version:o.version,timestamp:o.timestamp,session:o.session,map:o.map,phase:o.phase,health:o.self.health,position:o.self.position,mode:o.mode,epoch:o.epoch,ack:o.ack,lastAction:o.diagnostics.lastAction,actions:o.actions.map(a=>({id:a.id,kind:a.kind,label:a.kind}))};
   if(this.gate.mode!=='auto')return;
   if(!o.foreground&&now<this.focusUntil)return;
   if(o.phase==='unsupported'||!o.foreground){await this.setMode('manual');this.error=message(o.phase==='unsupported'?'etc.offlineOnly':'steam.foreground');return;}
   if(this.reconnectUntil){
    if(now>=this.reconnectUntil||o.matchId!==this.reconnectMatch||o.epoch!==this.gate.epoch){await this.setMode('manual');this.error=message('etc.lost');return;}
    this.reconnectUntil=0;
    await this.autoplay.resumeControl(this.gate.change('auto'));
   }
   // A positively observed portal journey can suspend game frames while the
   // destination streams in. Never extend this grace from stale telemetry.
   if(!this.portalUntil&&o.self.traveling&&this.autoplay.strategy==='portal'){
    this.portalUntil=now+15000;this.portalMatch=o.matchId;this.portalRoom=o.self.room;
   }
   if(this.portalUntil){
    if(now>=this.portalUntil||o.matchId!==this.portalMatch||o.epoch!==this.gate.epoch){
     await this.setMode('manual');this.error=message('etc.lost');return;
    }
    if(o.self.traveling)return;
    if(o.self.room===this.portalRoom)return;
    this.portalUntil=0;
    await this.autoplay.resumeControl(this.gate.change('auto'));
   }
   if(o.matchId!==this.autoplay.transitionMatch&&now<this.autoplay.transitionUntil){
    // A new world ID appears before room generation/drop-in finishes. Keep the
    // bounded loading grace and let native input leases expire until play starts.
    if(o.phase==='loading')return;
    this.autoplay.transitionUntil=0;
    await this.autoplay.change('auto',this.gate.change('auto'));
   }else if(o.mode==='manual'&&o.epoch===this.gate.epoch){
    await this.setMode('manual');this.error=message('etc.lost');return;
   }
   if(this.gate.mode!=='auto')return;
   await this.autoplay.tick(settings,this.gate.epoch);
   if(this.gate.mode!=='auto')return;
   this.decision=message(('etc.'+this.autoplay.strategy) as MessageKey);
  }finally{this.inFlight=false;}
 }
 private async detach(){const child=this.process;if(!child)return;this.send({op:'stop',epoch:++this.gate.epoch});child.stdin.end();await new Promise<void>(resolve=>{if(child.exitCode!==null)return resolve();child.once('exit',()=>resolve());setTimeout(()=>{child.kill();resolve();},2500).unref();});if(this.process===child)this.process=undefined;}
 async close(){if(this.timer)clearInterval(this.timer);await this.setMode('manual');await this.autoplay.close(this.gate.epoch);await this.detach();}
}
