import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, readFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { TypeSafeClient, choice } from '@typesafe-ai/sdk';
import { Store, atomicWrite } from './storage';
import type { GameState, PlayMode, GameAction } from '../shared/types';

export class ControlGate {
  mode:PlayMode='manual'; epoch=0;
  change(mode:PlayMode) { this.mode=mode; return ++this.epoch; }
  permits(epoch:number,observedAt:number,now=Date.now()) { return this.mode==='auto' && epoch===this.epoch && now-observedAt<2500 && observedAt<=now+500; }
}
export class Game {
  readonly gate=new ControlGate();
  state:GameState|null=null; error=''; decision='尚未启动';
  private session=randomUUID(); private token=randomBytes(32).toString('hex');
  private commandId=0; private writing:Promise<void>=Promise.resolve();
  private timer?:NodeJS.Timeout; private inFlight=false; private lastDecision=0; private abort?:AbortController;
  private ruleStep=0; private previousPosition:number[]=[]; private stuck=0;
  private transitionUntil=0;
  private process?:ReturnType<typeof spawn>;
  readonly directory:string;
  constructor(private store:Store,private log:(message:string)=>void) { this.directory=join(store.directory,'game-session'); }
  get connected() { return !!this.state && Date.now()-this.state.timestamp<2500 && this.state.session===this.session; }
  get pid() { return this.process?.pid; }
  async init() {
    await mkdir(this.directory,{recursive:true});
    try {
      const prior=JSON.parse(await readFile(join(this.directory,'session.json'),'utf8'));
      if(typeof prior.token==='string' && /^[a-f0-9]{64}$/.test(prior.token) && typeof prior.session==='string') {this.session=prior.session;this.token=prior.token;}
    } catch(e:any) {if(e.code!=='ENOENT')throw new Error('本机游戏会话文件损坏，请检查应用数据目录。');}
    this.gate.epoch=Date.now();this.commandId=Date.now();
    await atomicWrite(join(this.directory,'session.json'),JSON.stringify({session:this.session,token:this.token}));
    await this.command();
    this.timer=setInterval(()=>{void this.tick().catch(()=>{this.error='读取游戏状态失败。';});},200);
  }
  private command(action?:string) {
    const payload={session:this.session,token:this.token,id:++this.commandId,epoch:this.gate.epoch,mode:this.gate.mode,expiresAt:Date.now()+1800,...(action?{action}:{})};
    const task=this.writing.then(()=>atomicWrite(join(this.directory,'command.json'),JSON.stringify(payload)));
    this.writing=task.catch(()=>{}); return task;
  }
  async setMode(mode:PlayMode) {
    if(mode==='auto') {
      if(!this.connected) throw new Error('请先启动支持桥接的 ETC 开发版，等待游戏连接。');
      const settings=await this.store.settings();
      if(settings.decisionProvider==='jev' && !await this.store.get('jev.key')) throw new Error('请先在设置中保存 JEV API Key。');
    }
    this.gate.change(mode); this.abort?.abort(); this.decision=mode==='manual'?'由玩家操作':'等待下一次决策';
    await this.command(); this.log(mode==='manual'?'游戏已切换手动；停止自动输入。':'游戏自动控制已启用。');
  }
  async launch() {
    if(this.connected)throw new Error('游戏已连接，无需重复启动。');
    if(this.process && this.process.exitCode===null) throw new Error('本应用启动的游戏仍在运行。');
    const settings=await this.store.settings(); await access(join(settings.gameProject,'Lyra.uproject'));
    // Fixed command; user-supplied values only go through cwd and spawn argv.
    const {stdout}=await promisify(execFile)('cmd.exe',['/d','/s','/c','call Tools\\Engine.bat >nul && set ENGINE_DIR'],{cwd:settings.gameProject,windowsHide:true});
    const match=stdout.match(/^ENGINE_DIR=(.+)$/m); if(!match) throw new Error('ETC 的 Tools/Engine.bat 没有返回正确引擎。');
    await this.setMode('manual');
    const exe=join(match[1].trim(),'Engine','Binaries','Win64','UnrealEditor.exe');
    this.process=spawn(exe,[join(settings.gameProject,'Lyra.uproject'),'/EtcCore/Maps/L_ETC_MainMenu','-game','-windowed','-ResX=1600','-ResY=900','-NoSplash','-NoSteam',`-JevBridgeDir=${this.directory}`],{cwd:settings.gameProject,windowsHide:false,stdio:'ignore'});
    this.process.on('error',()=>{this.error='无法启动 ETC，请检查引擎与桥接编译结果。';});
    this.process.on('exit',()=>{void this.setMode('manual').catch(()=>{});this.log('ETC 游戏进程已退出。');});
    this.log('已启动 ETC 本机开发版，等待地图与桥接接口就绪。');
  }
  private async tick() {
    try {
      const raw=JSON.parse(await readFile(join(this.directory,'state.json'),'utf8'));
      if(raw.version===1 && raw.session===this.session && Array.isArray(raw.actions) && typeof raw.timestamp==='number') this.state=raw;
    } catch(e:any) { if(e.code!=='ENOENT') this.error='游戏状态暂时不可读，已暂停本轮操作。'; }
    if(!this.connected) {
      if(Date.now()<this.transitionUntil)return;
      if(this.gate.mode==='auto') { this.gate.change('manual');this.abort?.abort();await this.command();this.error='游戏连接中断，自动控制已停止。'; }
      return;
    }
    await this.command(); // Lease heartbeat; no action extends an expired action.
    if(this.gate.mode!=='auto' || this.inFlight) return;
    if(this.transitionUntil && this.state?.phase==='playing')this.transitionUntil=0;
    if(this.transitionUntil>Date.now() && this.state?.phase==='menu')return;
    const settings=await this.store.settings();
    if(Date.now()-this.lastDecision<settings.decisionIntervalMs) return;
    this.lastDecision=Date.now(); this.inFlight=true;
    const epoch=this.gate.epoch, observed=this.state!;
    const controller=new AbortController();this.abort=controller;
    try {
      const actions=observed.actions.filter(a=>a.kind!=='new_match' || observed.phase==='menu' || settings.autoRestart);
      if(!actions.length) return;
      let action:GameAction|undefined;
      if(settings.decisionProvider==='jev') {
        const key=await this.store.get<string>('jev.key');
        if(!key) throw new Error('missing_key');
        const client=new TypeSafeClient({apiKey:key,baseURL:'https://api.typesafe.ai',defaultModel:'jev-latest',timeout:1800,retry:{maxRetries:0}});
        const options=Object.fromEntries(actions.map(a=>[a.id,a.label]));
        const response=await client.systemOne({state:{game:'Enter the Cube offline bot match',phase:observed.phase,health:observed.health,position:observed.position,previousAction:observed.lastAction ?? '',goal:'Survive, explore, collect equipment, shoot visible opponents. Reload between fights. Only choose from available actions.'},questions:{action:choice('Which action should the player take next?',options)}},{signal:controller.signal});
        action=actions.find(a=>a.id===response.answers.action.choice);
      } else action=this.ruleAction(observed,actions);
      // No stale decision may cross a manual handover or execute on old observation.
      if(action && this.gate.permits(epoch,observed.timestamp) && this.connected && !controller.signal.aborted) {
        if(action.kind==='new_match')this.transitionUntil=Date.now()+120000;
        await this.command(action.id);this.decision=action.label;this.error='';
      }
    } catch {
      if(!controller.signal.aborted) { this.error='决策请求失败或超时；本轮停止操作，稍后重试。'; this.decision='等待有效决策'; }
    } finally { this.inFlight=false; }
  }
  private ruleAction(state:GameState,actions:GameAction[]) {
    this.ruleStep++;
    const moved=state.position.reduce((sum,x,i)=>sum+Math.abs(x-(this.previousPosition[i]??x)),0);
    this.stuck=moved<10?this.stuck+1:0;this.previousPosition=state.position;
    const find=(kind:string)=>actions.find(a=>a.kind===kind);
    if(find('new_match')) return find('new_match');
    if(state.phase!=='playing') return find('wait');
    if(this.ruleStep%9===0) return find('reload');
    if(find('shoot')) return find('shoot');
    if(this.stuck>5) { this.stuck=0; return find(this.ruleStep%2?'right':'jump'); }
    return find('loot')??find('portal')??(this.ruleStep%6===0?find('right'):find('move'))??find('wait');
  }
  async close() { if(this.timer) clearInterval(this.timer); await this.setMode('manual'); }
}
