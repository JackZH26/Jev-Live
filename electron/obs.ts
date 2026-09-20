import { message } from '../shared/i18n';
import OBSWebSocket from 'obs-websocket-js';
import { cp, mkdir, access, readFile } from 'node:fs/promises';
import { join, resolve, relative } from 'node:path';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { Store, atomicWrite } from './storage';
import { delay } from './http';
import type { OutputState, Provider } from '../shared/types';
import { providers, providerNames } from '../shared/types';
import type { Layout } from '../shared/hosting';

export const obsPorts:Record<Provider,number>={youtube:44551,twitch:44552,x:44553};
export const xEncoderSettings=(bitrate:number)=>({rate_control:'CBR',bitrate,keyint_sec:3,profile:'high',preset:'p5'});

const blank=():OutputState=>({connected:false,ready:false,active:false,reconnecting:false,frames:0,skipped:0,bytes:0});
export class Obs {
  readonly states:Record<Provider,OutputState>={youtube:blank(),twitch:blank(),x:blank()};
  private clients:Partial<Record<Provider,OBSWebSocket>>={};
  private processes:Partial<Record<Provider,ReturnType<typeof spawn>>>={};
  private polling=false;
  constructor(private store:Store,private log:(message:string)=>void) {}
  async setup(only?:Provider[],signal?:AbortSignal) {
    const settings=await this.store.settings();
    if(!settings.enabledPlatforms.length)throw new Error(message('channels.minimum'));
    const source=resolve(settings.obsDirectory);
    await access(join(source,'bin','64bit','obs64.exe'));
    for(const provider of settings.enabledPlatforms.filter(p=>!only||only.includes(p))) {
      signal?.throwIfAborted();
      if(this.states[provider].connected && this.states[provider].ready) continue;
      if(this.states[provider].connected) await this.clients[provider]?.disconnect();
      const root=join(this.store.directory,'obs',provider);
      if(!relative(source,root).startsWith('..') || source===root) throw new Error(message('error.obsPath'));
      const exe=join(root,'bin','64bit','obs64.exe');
      try { await access(join(root,'jev-copy.complete')); }
      catch {
        this.log(message('event.obsCopy',{provider}));
        await mkdir(root,{recursive:true});
        // Only the distribution directories, never the user's existing profiles.
        for(const folder of ['bin','data','obs-plugins']) await cp(join(source,folder),join(root,folder),{recursive:true});
        await atomicWrite(join(root,'jev-copy.complete'),'1');
      }
      let password=await this.store.get<string>(`obs.${provider}.password`);
      if(!password) { password=randomBytes(32).toString('base64url');await this.store.set(`obs.${provider}.password`,password); }
      const port=obsPorts[provider];
      const config=join(root,'config','obs-studio');
      await mkdir(join(config,'plugin_config','obs-websocket'),{recursive:true});
      await mkdir(join(config,'basic','profiles','JEV'),{recursive:true});
      await mkdir(join(config,'basic','scenes'),{recursive:true});
      await atomicWrite(join(config,'plugin_config','obs-websocket','config.json'),JSON.stringify({first_load:false,server_enabled:true,server_port:port,alerts_enabled:false,auth_required:true,server_password:password}));
      const basic=join(config,'basic','profiles','JEV','basic.ini');
      try { await access(basic); } catch {
        await atomicWrite(basic,`[General]\nName=JEV\n\n[Video]\nBaseCX=1920\nBaseCY=1080\nOutputCX=1920\nOutputCY=1080\nFPSType=0\nFPSCommon=60\n\n[Output]\nMode=${provider==='x'?'Advanced':'Simple'}\nReconnect=true\nRetryDelay=2\nMaxRetries=60\n\n[SimpleOutput]\nStreamEncoder=nvenc\nVBitrate=6000\nABitrate=160\n\n[AdvOut]\nEncoder=obs_nvenc_h264_tex\nAudioEncoder=ffmpeg_aac\nTrackIndex=1\nTrack1Bitrate=128\nApplyServiceSettings=false\nRecType=Standard\nRecEncoder=none\nRecAudioEncoder=none\nRecFormat2=mkv\n\n[Audio]\nSampleRate=48000\nChannelSetup=Stereo\n`);
        if(provider==='x')await atomicWrite(join(config,'basic','profiles','JEV','streamEncoder.json'),JSON.stringify(xEncoderSettings(settings.bitrate)));
        await atomicWrite(join(config,'global.ini'),'[General]\nFirstRun=true\nEnableAutoUpdates=false\n\n[Basic]\nProfile=JEV\nProfileDir=JEV\nSceneCollection=JEV\nSceneCollectionFile=JEV\n\n[BasicWindow]\nWarnBeforeStartingStream=false\nWarnBeforeStoppingStream=false\nSysTrayEnabled=true\nSysTrayWhenStarted=true\n');
        // OBS 32 split app/user settings; seed both for first start.
        await atomicWrite(join(config,'user.ini'),'[Basic]\nProfile=JEV\nProfileDir=JEV\nSceneCollection=JEV\nSceneCollectionFile=JEV\n\n[General]\nFirstRun=true\n');
        await atomicWrite(join(config,'basic','scenes','JEV.json'),JSON.stringify({name:'JEV',current_scene:'JEV Program',current_program_scene:'JEV Program',scene_order:[{name:'JEV Program'}],sources:[{name:'JEV Program',id:'scene',versioned_id:'scene',settings:{items:[]},mixers:0}],groups:[],quick_transitions:[]}));
      }
      const client=new OBSWebSocket();
      client.on('ConnectionClosed',()=>{this.states[provider].connected=false;this.states[provider].ready=false;});
      client.on('ConnectionError',()=>{this.states[provider].connected=false;this.states[provider].ready=false;});
      client.on('StreamStateChanged',e=>{this.states[provider].active=e.outputActive;this.states[provider].reconnecting=e.outputState==='OBS_WEBSOCKET_OUTPUT_RECONNECTING';});
      try { await client.connect(`ws://127.0.0.1:${port}`,password); }
      catch {
        this.processes[provider]=spawn(exe,['--portable','--multi','--disable-updater','--disable-shutdown-check','--minimize-to-tray','--profile','JEV','--collection','JEV','--websocket_ipv4_only'],{cwd:join(root,'bin','64bit'),windowsHide:true,stdio:'ignore'});
        let launchError=false;this.processes[provider]!.on('error',()=>{launchError=true;});
        let connected=false;
        for(let n=0;n<30;n++) {
          if(launchError) break;await delay(1000,signal);
          try { await client.connect(`ws://127.0.0.1:${port}`,password);connected=true;break; } catch {}
        }
        if(!connected) throw new Error(message('error.obsConnect',{provider,port}));
      }
      this.clients[provider]=client;this.states[provider].connected=true;
      // OBS WebSocket accepts connections before frontend FINISHED_LOADING.
      let stream:Awaited<ReturnType<typeof client.call<'GetStreamStatus'>>>|undefined;
      for(let attempt=0;attempt<40;attempt++) {
        try { signal?.throwIfAborted();stream=await client.call('GetStreamStatus');break; } catch {await delay(500,signal);}
      }
      if(!stream) {this.states[provider].connected=false;throw new Error(message('error.obsInitializing',{provider}));}
      this.states[provider].active=stream.outputActive;
      if(stream.outputActive) { this.states[provider].ready=true;this.log(message('event.obsResumed',{provider}));continue; }
      const scenes=await client.call('GetSceneList');
      if(!scenes.scenes.some(s=>s.sceneName==='JEV Program')) await client.call('CreateScene',{sceneName:'JEV Program'});
      await client.call('SetCurrentProgramScene',{sceneName:'JEV Program'});
      await client.call('SetVideoSettings',{baseWidth:1920,baseHeight:1080,outputWidth:1920,outputHeight:1080,fpsNumerator:60,fpsDenominator:1});
      await client.call('SetProfileParameter',{parameterCategory:'SimpleOutput',parameterName:'VBitrate',parameterValue:String(settings.bitrate)});
      if(provider==='x') {
        // The live account's encoder guide recommends 1080p60, AAC 128 and a 3-second GOP.
        // OBS AdvancedOutput reads streamEncoder.json on each encoder update.
        await atomicWrite(join(config,'basic','profiles','JEV','streamEncoder.json'),JSON.stringify(xEncoderSettings(settings.bitrate)));
        await client.call('SetProfileParameter',{parameterCategory:'AdvOut',parameterName:'Track1Bitrate',parameterValue:'128'});
        await client.call('SetProfileParameter',{parameterCategory:'AdvOut',parameterName:'ApplyServiceSettings',parameterValue:'false'});
      }
      const inputs=await client.call('GetInputList');
      if(!inputs.inputs.some(i=>i.inputName==='ETC Game')) await client.call('CreateInput',{sceneName:'JEV Program',inputName:'ETC Game',inputKind:'window_capture',inputSettings:{window:settings.gameWindow,method:2,priority:2,cursor:false,client_area:true},sceneItemEnabled:true});
      if(!inputs.inputs.some(i=>i.inputName==='ETC Audio')) await client.call('CreateInput',{sceneName:'JEV Program',inputName:'ETC Audio',inputKind:'wasapi_process_output_capture',inputSettings:{window:settings.gameWindow,priority:2},sceneItemEnabled:true});
      await this.fit(provider);
      this.states[provider].ready=true;
      this.log(message('event.obsReady',{provider:providerNames[provider],fps:60}));
    }
  }
  private client(provider:Provider) {
    const client=this.clients[provider];if(!client || !this.states[provider].connected) throw new Error(message('error.obsDisconnected',{provider}));return client;
  }
  async windows() {
    const settings=await this.store.settings();
    const provider=settings.enabledPlatforms.find(p=>this.states[p].connected)??settings.enabledPlatforms[0];
    if(!provider)throw new Error(message('channels.minimum'));
    const result=await this.client(provider).call('GetInputPropertiesListPropertyItems',{inputName:'ETC Game',propertyName:'window'});
    return result.propertyItems.filter(i=>i.itemEnabled).map(i=>({label:String(i.itemName),value:String(i.itemValue)}));
  }
  async capture(value:string) {
    if(!(await this.windows()).some(w=>w.value===value)) throw new Error(message('error.windowGone'));
    const settings=await this.store.settings();
    for(const provider of settings.enabledPlatforms) {
      const client=this.client(provider);
      for(const inputName of ['ETC Game','ETC Audio']) await client.call('SetInputSettings',{inputName,inputSettings:{window:value,priority:2},overlay:true});
      await this.fit(provider);
    }
    await this.store.saveSettings({...settings,gameWindow:value});
  }
  private async fit(provider:Provider) {
    const client=this.client(provider);
    const item=await client.call('GetSceneItemId',{sceneName:'JEV Program',sourceName:'ETC Game'});
    await client.call('SetSceneItemTransform',{sceneName:'JEV Program',sceneItemId:item.sceneItemId,sceneItemTransform:{positionX:0,positionY:0,boundsType:'OBS_BOUNDS_SCALE_INNER',boundsWidth:1920,boundsHeight:1080,alignment:5}});
  }
  async preview(provider:Provider) { return (await this.client(provider).call('GetSourceScreenshot',{sourceName:'JEV Program',imageFormat:'jpg',imageWidth:960,imageCompressionQuality:65})).imageData; }
  async gamePreview(provider:Provider) { return (await this.client(provider).call('GetSourceScreenshot',{sourceName:'ETC Game',imageFormat:'jpg',imageWidth:960,imageCompressionQuality:65})).imageData; }
  async overlay(provider:Provider,url:string,layout:Layout){
    const c=this.client(provider),inputs=await c.call('GetInputList');
    const inputSettings={url,width:1920,height:1080,fps:60,fps_custom:true,shutdown:false,restart_when_active:false,reroute_audio:true,css:'body { background-color: rgba(0,0,0,0); margin: 0; overflow: hidden; }'};
    if(!inputs.inputs.some(i=>i.inputName==='JEV Host'))await c.call('CreateInput',{sceneName:'JEV Program',inputName:'JEV Host',inputKind:'browser_source',inputSettings,sceneItemEnabled:true});
    else await c.call('SetInputSettings',{inputName:'JEV Host',inputSettings,overlay:true});
    await c.call('SetInputAudioMonitorType',{inputName:'JEV Host',monitorType:'OBS_MONITORING_TYPE_NONE'});
    const game=await c.call('GetSceneItemId',{sceneName:'JEV Program',sourceName:'ETC Game'});
    await c.call('SetSceneItemTransform',{sceneName:'JEV Program',sceneItemId:game.sceneItemId,sceneItemTransform:{positionX:layout.game.x,positionY:layout.game.y,boundsType:'OBS_BOUNDS_SCALE_INNER',boundsWidth:layout.game.width,boundsHeight:layout.game.height,alignment:5}});
    await c.call('SetSceneItemEnabled',{sceneName:'JEV Program',sceneItemId:game.sceneItemId,sceneItemEnabled:layout.game.visible});
    const host=await c.call('GetSceneItemId',{sceneName:'JEV Program',sourceName:'JEV Host'});const list=await c.call('GetSceneItemList',{sceneName:'JEV Program'});await c.call('SetSceneItemIndex',{sceneName:'JEV Program',sceneItemId:host.sceneItemId,sceneItemIndex:list.sceneItems.length-1});
  }
  async service(provider:Provider,server:string,key:string) {
    if(!/^rtmps?:\/\//.test(server)) throw new Error(message('error.destination'));
    await this.client(provider).call('SetStreamServiceSettings',{streamServiceType:'rtmp_custom',streamServiceSettings:{server,key,use_auth:false}});
  }
  async start(provider:Provider,signal?:AbortSignal) { signal?.throwIfAborted();const c=this.client(provider);await c.call('StartStream');for(let i=0;i<60;i++){signal?.throwIfAborted();const s=await c.call('GetStreamStatus');if(s.outputActive&&!s.outputReconnecting){this.states[provider].active=true;return;}await delay(500,signal);}throw new Error(message('error.obsStart',{provider:providerNames[provider]})); }
  async stop(provider:Provider) {
    const c=this.client(provider); const s=await c.call('GetStreamStatus');
    if(s.outputActive) await c.call('StopStream');
    for(let i=0;i<20;i++) { if(!(await c.call('GetStreamStatus')).outputActive) { this.states[provider].active=false;return; } await delay(500); }
    throw new Error(message('error.obsStop',{provider}));
  }
  async clearKey(provider:Provider) {
    if(this.states[provider].connected && !this.states[provider].active) await this.client(provider).call('SetStreamServiceSettings',{streamServiceType:'rtmp_custom',streamServiceSettings:{server:'rtmp://localhost/disabled',key:'',use_auth:false}});
  }
  async poll() {
    if(this.polling)return;this.polling=true;
    try {
      await Promise.allSettled(providers.map(async p=>{
        if(!this.states[p].connected)return;
        try { const s=await this.client(p).call('GetStreamStatus');Object.assign(this.states[p],{active:s.outputActive,reconnecting:s.outputReconnecting,frames:s.outputTotalFrames,skipped:s.outputSkippedFrames,bytes:s.outputBytes,error:undefined}); }
        catch { this.states[p].error=message('error.obsStatus'); }
      }));
    } finally { this.polling=false; }
  }
}
