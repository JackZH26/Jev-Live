import { message } from '../shared/i18n';
import OBSWebSocket from 'obs-websocket-js';
import { cp, mkdir, access, readFile } from 'node:fs/promises';
import { join, resolve, relative } from 'node:path';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { Store, atomicWrite } from './storage';
import { delay } from './http';
import type { OutputState, Provider } from '../shared/types';

const blank=():OutputState=>({connected:false,ready:false,active:false,reconnecting:false,frames:0,skipped:0,bytes:0});
export class Obs {
  readonly states:Record<Provider,OutputState>={youtube:blank(),twitch:blank()};
  private clients:Partial<Record<Provider,OBSWebSocket>>={};
  private processes:Partial<Record<Provider,ReturnType<typeof spawn>>>={};
  private polling=false;
  constructor(private store:Store,private log:(message:string)=>void) {}
  async setup() {
    const settings=await this.store.settings();
    const source=resolve(settings.obsDirectory);
    await access(join(source,'bin','64bit','obs64.exe'));
    for(const provider of ['youtube','twitch'] as const) {
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
      const port=provider==='youtube'?44551:44552;
      const config=join(root,'config','obs-studio');
      await mkdir(join(config,'plugin_config','obs-websocket'),{recursive:true});
      await mkdir(join(config,'basic','profiles','JEV'),{recursive:true});
      await mkdir(join(config,'basic','scenes'),{recursive:true});
      await atomicWrite(join(config,'plugin_config','obs-websocket','config.json'),JSON.stringify({first_load:false,server_enabled:true,server_port:port,alerts_enabled:false,auth_required:true,server_password:password}));
      const basic=join(config,'basic','profiles','JEV','basic.ini');
      try { await access(basic); } catch {
        await atomicWrite(basic,'[General]\nName=JEV\n\n[Video]\nBaseCX=1920\nBaseCY=1080\nOutputCX=1920\nOutputCY=1080\nFPSType=0\nFPSCommon=60\n\n[Output]\nMode=Simple\nReconnect=true\nRetryDelay=2\nMaxRetries=60\n\n[SimpleOutput]\nStreamEncoder=nvenc\nVBitrate=6000\nABitrate=160\n\n[Audio]\nSampleRate=48000\nChannelSetup=Stereo\n');
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
          if(launchError) break;await delay(1000);
          try { await client.connect(`ws://127.0.0.1:${port}`,password);connected=true;break; } catch {}
        }
        if(!connected) throw new Error(message('error.obsConnect',{provider,port}));
      }
      this.clients[provider]=client;this.states[provider].connected=true;
      // OBS WebSocket accepts connections before frontend FINISHED_LOADING.
      let stream:Awaited<ReturnType<typeof client.call<'GetStreamStatus'>>>|undefined;
      for(let attempt=0;attempt<40;attempt++) {
        try { stream=await client.call('GetStreamStatus');break; } catch {await delay(500);}
      }
      if(!stream) {this.states[provider].connected=false;throw new Error(message('error.obsInitializing',{provider}));}
      this.states[provider].active=stream.outputActive;
      if(stream.outputActive) { this.states[provider].ready=true;this.log(message('event.obsResumed',{provider}));continue; }
      const scenes=await client.call('GetSceneList');
      if(!scenes.scenes.some(s=>s.sceneName==='JEV Program')) await client.call('CreateScene',{sceneName:'JEV Program'});
      await client.call('SetCurrentProgramScene',{sceneName:'JEV Program'});
      await client.call('SetVideoSettings',{baseWidth:1920,baseHeight:1080,outputWidth:1920,outputHeight:1080,fpsNumerator:60,fpsDenominator:1});
      await client.call('SetProfileParameter',{parameterCategory:'SimpleOutput',parameterName:'VBitrate',parameterValue:String(settings.bitrate)});
      const inputs=await client.call('GetInputList');
      if(!inputs.inputs.some(i=>i.inputName==='ETC Game')) await client.call('CreateInput',{sceneName:'JEV Program',inputName:'ETC Game',inputKind:'window_capture',inputSettings:{window:settings.gameWindow,method:2,priority:2,cursor:false,client_area:true},sceneItemEnabled:true});
      if(!inputs.inputs.some(i=>i.inputName==='ETC Audio')) await client.call('CreateInput',{sceneName:'JEV Program',inputName:'ETC Audio',inputKind:'wasapi_process_output_capture',inputSettings:{window:settings.gameWindow,priority:2},sceneItemEnabled:true});
      await this.fit(provider);
      this.states[provider].ready=true;
      this.log(message('event.obsReady',{provider}));
    }
  }
  private client(provider:Provider) {
    const client=this.clients[provider];if(!client || !this.states[provider].connected) throw new Error(message('error.obsDisconnected',{provider}));return client;
  }
  async windows() {
    const result=await this.client('youtube').call('GetInputPropertiesListPropertyItems',{inputName:'ETC Game',propertyName:'window'});
    return result.propertyItems.filter(i=>i.itemEnabled).map(i=>({label:String(i.itemName),value:String(i.itemValue)}));
  }
  async capture(value:string) {
    if(!(await this.windows()).some(w=>w.value===value)) throw new Error(message('error.windowGone'));
    for(const provider of ['youtube','twitch'] as const) {
      const client=this.client(provider);
      for(const inputName of ['ETC Game','ETC Audio']) await client.call('SetInputSettings',{inputName,inputSettings:{window:value,priority:2},overlay:true});
      await this.fit(provider);
    }
    const settings=await this.store.settings(); await this.store.saveSettings({...settings,gameWindow:value});
  }
  private async fit(provider:Provider) {
    const client=this.client(provider);
    const item=await client.call('GetSceneItemId',{sceneName:'JEV Program',sourceName:'ETC Game'});
    await client.call('SetSceneItemTransform',{sceneName:'JEV Program',sceneItemId:item.sceneItemId,sceneItemTransform:{positionX:0,positionY:0,boundsType:'OBS_BOUNDS_SCALE_INNER',boundsWidth:1920,boundsHeight:1080,alignment:5}});
  }
  async preview(provider:Provider) { return (await this.client(provider).call('GetSourceScreenshot',{sourceName:'JEV Program',imageFormat:'jpg',imageWidth:960,imageCompressionQuality:65})).imageData; }
  async service(provider:Provider,server:string,key:string) {
    if(!/^rtmps?:\/\//.test(server)) throw new Error(message('error.destination'));
    await this.client(provider).call('SetStreamServiceSettings',{streamServiceType:'rtmp_custom',streamServiceSettings:{server,key,use_auth:false}});
  }
  async start(provider:Provider) { await this.client(provider).call('StartStream');this.states[provider].active=true; }
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
      await Promise.allSettled((['youtube','twitch'] as const).map(async p=>{
        if(!this.states[p].connected)return;
        try { const s=await this.client(p).call('GetStreamStatus');Object.assign(this.states[p],{active:s.outputActive,reconnecting:s.outputReconnecting,frames:s.outputTotalFrames,skipped:s.outputSkippedFrames,bytes:s.outputBytes,error:undefined}); }
        catch { this.states[p].error=message('error.obsStatus'); }
      }));
    } finally { this.polling=false; }
  }
}
