import { message, t, locales, type Locale } from '../shared/i18n';
import { app, BrowserWindow, ipcMain, safeStorage, shell, dialog, Tray, Menu, nativeImage, globalShortcut } from 'electron';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { Store, settingsSchema } from './storage';
import { OAuth } from './oauth';
import { Obs } from './obs';
import { Game } from './game';
import { Steam } from './steam';
import { Platforms } from './platforms';
import { Broadcast } from './broadcast';
import { XLive } from './x-live';
import { Hosting } from './hosting';
import { OverlayServer } from './overlay-server';
import {streamChecks,type ReadinessReport} from '../shared/readiness';
import {neuralHealth} from './neural-speech';
import {access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {SessionHealth} from '../shared/session-health';
import { providers } from '../shared/types';
import type { Snapshot } from '../shared/types';

app.setName('JEV Studio');
// Keep an isolated test workspace from claiming the installed application's lock.
if(process.env.JEV_TEST_DATA_DIR)app.setPath('userData',process.env.JEV_TEST_DATA_DIR);
if(!app.requestSingleInstanceLock()) app.quit();
let window:BrowserWindow, tray:Tray, closing=false, busy='',lastError='';
let store:Store,auth:OAuth,obs:Obs,game:Game,broadcast:Broadcast,xLive:XLive;
let hosting:Hosting,overlay:OverlayServer;
const health=new SessionHealth();let healthBusy=false;
let currentLocale:Locale='zh-CN';
const logs:Snapshot['logs']=[];
const log=(message:string)=>{logs.unshift({at:new Date().toISOString(),message});logs.splice(0,logs.length,...logs.slice(0,100));};
function updateTray(){if(tray)tray.setContextMenu(Menu.buildFromTemplate([{label:t(currentLocale,'tray.open'),click:()=>window.show()},{label:t(currentLocale,'tray.manual'),click:()=>{void game.setMode('manual');}},{type:'separator'},{label:t(currentLocale,'tray.quit'),click:()=>app.quit()}]));}
const provider=z.enum(providers),oauthProvider=z.enum(['youtube','twitch']);
const mode=z.enum(['manual','auto']);
const dev=process.env.JEV_DEV_URL;

function handler(name:string,fn:(arg:any)=>Promise<any>,operation?:string) {
  ipcMain.handle(`studio:${name}`,async(event,arg)=>{
    if(event.sender!==window.webContents || event.senderFrame!==window.webContents.mainFrame) throw new Error('Unauthorized caller');
    if(operation && busy) return {ok:false,error:message('error.busy')};
    if(operation)busy=operation;
    try { const data=await fn(arg);return {ok:true,data}; }
    catch(e) { let errorText=e instanceof Error?e.message:message('error.generic');if(errorText.startsWith('host.'))errorText='@jev:'+JSON.stringify({key:errorText});if(errorText==='speech.unavailable')errorText=message('host.speechError');lastError=errorText.slice(0,500);log(lastError);return {ok:false,error:lastError}; }
    finally {if(operation)busy='';}
  });
}
function allowedExternal(raw:string) {
  const u=new URL(raw);
  if(u.protocol!=='https:' || u.port || u.username || u.password || !['www.youtube.com','studio.youtube.com','www.twitch.tv','dev.twitch.tv','console.cloud.google.com','docs.typesafe.ai','developers.google.com','x.com','studio.x.com'].includes(u.hostname))throw new Error(message('error.external'));
  return u.href;
}

app.whenReady().then(async()=>{
  const directory=process.env.JEV_TEST_DATA_DIR || app.getPath('userData');
  store=new Store(directory,safeStorage);await store.init();
  xLive=new XLive(store);
  currentLocale=(await store.settings()).locale;
  const steam=new Steam(url=>shell.openExternal(url));
  auth=new OAuth(store,url=>shell.openExternal(url),log);obs=new Obs(store,log);game=new Game(store,log,steam,join(app.isPackaged?process.resourcesPath:app.getAppPath(),'dist-native','SteamObserver.exe'));
  broadcast=new Broadcast(store,obs,auth,new Platforms(auth),log,p=>obs.overlay(p,overlay.url(p),hosting.config.layouts[p]));await game.init();await broadcast.init();
  hosting=new Hosting(store,auth,()=>JSON.stringify({game:game.selected?.name??'',connected:game.connected,phase:game.connected?game.state?.phase??'unknown':'unknown',visibleText:game.connected?game.observation?.lines?.map(l=>l.text).join(' ').slice(0,3000)??'':''}),()=>broadcast.state.youtubeId,()=>game.connected);
  await hosting.init();overlay=new OverlayServer(hosting,join(__dirname,'../../dist'));await overlay.start();
  const applyLayouts=async()=>{for(const p of (await store.settings()).enabledPlatforms)if(obs.states[p].ready)await obs.overlay(p,overlay.url(p),hosting.config.layouts[p]);};
  window=new BrowserWindow({width:1480,height:960,minWidth:1080,minHeight:720,backgroundColor:'#f2f3f8',title:'JEV Studio',autoHideMenuBar:true,webPreferences:{preload:join(__dirname,'preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true}});
  window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  window.webContents.on('will-navigate',(event)=>event.preventDefault());
  window.webContents.session.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));
  window.webContents.session.setPermissionCheckHandler(()=>false);
  handler('snapshot',async()=>({settings:await store.settings(),accounts:await auth.accounts(),xSource:await xLive.summary(),outputs:obs.states,mode:game.gate.mode,game:game.connected?game.state:null,gameConnected:game.connected,gameError:game.error,gamePid:game.pid,decision:game.decision,busy,lastError,hasJevKey:!!await store.get('jev.key'),auth:auth.status,logs,broadcast:broadcast.state,recovery:broadcast.recovery.status,health:health.issues,steamGames:steam.games,selectedGame:game.selected,decisionStats:game.decisionStats,autoplay:game.autoplay.summary,gameInput:{foreground:game.autoplay.observation?.foreground??game.observation?.foreground??false,heldInputs:game.autoplay.observation?.diagnostics.heldInputs??game.observation?.heldInputs??0}} satisfies Snapshot));
  const gameId=z.string().regex(/^\d+$/).max(12);
  const requireGameIdle=()=>{if(broadcast.state.state!=='idle'||game.gate.mode==='auto')throw new Error(message('error.gameSelectionBusy'));};
  handler('scanSteam',()=>steam.scan(),message('steam.scan'));
  handler('addSteamGame',async value=>{const id=gameId.parse(value);if(!await steam.get(id))throw new Error(message('error.steamSelection'));const settings=await store.settings();await store.saveSettings({...settings,addedSteamGames:[...new Set([...settings.addedSteamGames,id])]});});
  handler('selectSteamGame',async value=>{requireGameIdle();const id=gameId.parse(value),settings=await store.settings();if(!settings.addedSteamGames.includes(id)||!await steam.get(id))throw new Error(message('error.steamSelection'));await game.select(id);await store.saveSettings({...settings,steamAppId:id,gameWindow:''});log(message('event.steamSelected',{name:game.selected!.name}));},message('steam.choose'));
  handler('removeSteamGame',async value=>{requireGameIdle();const id=gameId.parse(value),settings=await store.settings();if(settings.steamAppId===id)await game.select('');await store.saveSettings({...settings,addedSteamGames:settings.addedSteamGames.filter(g=>g!==id),...(settings.steamAppId===id?{steamAppId:'',gameWindow:''}:{})});});
  handler('saveSettings',async value=>{
    const next=settingsSchema.parse(value),old=await store.settings();
    if(auth.pending.size)throw new Error(message('error.settingsDuringLogin'));
    if(broadcast.state.state!=='idle' || game.gate.mode==='auto')throw new Error(message('error.settingsDuringRun'));
    if(next.googleClientId!==old.googleClientId) {await store.set('oauth.youtube',undefined);await store.set('google.clientSecret',undefined);}
    if(next.twitchClientId!==old.twitchClientId)await store.set('oauth.twitch',undefined);
    // Dedicated selectors own game/output selection, including when settings were opened earlier.
    await store.saveSettings({...next,steamAppId:old.steamAppId,addedSteamGames:old.addedSteamGames,enabledPlatforms:old.enabledPlatforms,gameWindow:old.gameWindow});
    currentLocale=next.locale;updateTray();
  });
  handler('selectPlatforms',async value=>{
    if(broadcast.state.state!=='idle')throw new Error(message('error.livePending'));
    const selected=settingsSchema.shape.enabledPlatforms.parse(value),old=await store.settings();
    const addedOutput=selected.some(p=>!old.enabledPlatforms.includes(p));
    // Platform selection is independent of manual/automatic game control.
    // Require capture application when adding an output that may have an older scene.
    await store.saveSettings({...old,enabledPlatforms:selected,gameWindow:addedOutput?'':old.gameWindow});
  },message('busy.platforms'));
  handler('setLocale',async value=>{const locale=z.enum(locales).parse(value);await store.saveSettings({...await store.settings(),locale});currentLocale=locale;updateTray();});
  handler('saveJevKey',async value=>{const key=z.string().trim().min(8).max(4096).parse(value);await store.set('jev.key',key);log(message('event.keySaved'));});
  handler('importGoogleClient',async()=>{
    if(auth.pending.size || broadcast.state.state!=='idle')throw new Error(message('error.finishAuthOrLive'));
    const result=await dialog.showOpenDialog(window,{title:t(currentLocale,'dialog.googleImport'),properties:['openFile'],filters:[{name:'Google OAuth JSON',extensions:['json']}]});
    if(result.canceled)return false;
    const raw=JSON.parse(await readFile(result.filePaths[0],'utf8'));
    const c=z.object({client_id:z.string().endsWith('.apps.googleusercontent.com'),client_secret:z.string().optional()}).parse(raw.installed);
    await store.set('google.clientSecret',c.client_secret);await store.set('oauth.youtube',undefined);
    await store.saveSettings({...await store.settings(),googleClientId:c.client_id});return true;
  });
  handler('connectAccount',async value=>{await auth.login(oauthProvider.parse(value));});
  handler('cancelLogin',async value=>auth.cancel(oauthProvider.parse(value)));
  handler('disconnectAccount',async value=>{if(broadcast.state.state!=='idle')throw new Error(message('error.logoutDuringLive'));await auth.disconnect(oauthProvider.parse(value));});
  handler('saveXSource',async value=>{if(broadcast.state.state!=='idle'||obs.states.x.active)throw new Error(message('error.livePending'));await xLive.save(value);log(message('event.xSaved'));},message('busy.xSource'));
  handler('removeXSource',async()=>{if(broadcast.state.state!=='idle'||obs.states.x.active)throw new Error(message('error.livePending'));await obs.clearKey('x');await xLive.remove();},message('busy.xSource'));
  handler('setupOBS',async()=>{await obs.setup();await applyLayouts();},message('busy.obs'));
  handler('windows',()=>obs.windows());handler('setCapture',async value=>{await obs.capture(z.string().min(1).max(1000).parse(value));await applyLayouts();},message('busy.capture'));
  handler('hostSnapshot',async()=>({...await hosting.snapshot(),assetUrl:overlay.assetURL()}));
  handler('preflight',async()=>{
    await obs.poll();const settings=await store.settings(),accounts=await auth.accounts();
    const checks=streamChecks({settings,accounts,xSource:await xLive.summary(),outputs:obs.states,selectedGame:game.selected,gameConnected:game.connected} as Snapshot);
    const installed=await access(join(settings.obsDirectory,'bin/64bit/obs64.exe')).then(()=>true,()=>false);
    checks.unshift({id:'obs-install',key:'setup.obsInstall',ready:installed,required:!settings.enabledPlatforms.every(p=>obs.states[p].ready),action:'obs'});
    let model=false;try{const url=hosting.config.apiBase.replace(/\/$/,'')+(hosting.config.modelProvider==='ollama'?'/api/tags':'/models');const r=await fetch(url,{signal:AbortSignal.timeout(2500),redirect:'error'});if(r.ok){const data=await r.json() as any;model=hosting.config.modelProvider==='ollama'?data.models?.some((m:any)=>m.name===hosting.config.model):data.data?.some((m:any)=>m.id===hosting.config.model);}}catch{}
    const speech=!hosting.config.speech||(hosting.config.speechProvider!=='system'?await neuralHealth(hosting.config.speechProvider):hosting.voices.some(v=>hosting.config.voice?v.name===hosting.config.voice:v.language.split('-')[0]===hosting.config.language.split('-')[0]));
    checks.push({id:'model',key:'setup.model',ready:!!model,required:false,action:'host'},{id:'voice',key:'setup.voice',ready:speech,required:false,action:'host'});
    if(hosting.config.chatPlatforms.includes('twitch')){let granted=false;try{const c=await auth.credentials('twitch'),scopes=typeof c.scope==='string'?c.scope.split(' '):c.scope??[];granted=['user:read:chat','user:write:chat'].every(scope=>scopes.includes(scope));}catch{}checks.push({id:'chat-twitch',key:'setup.chat',provider:'twitch',ready:granted,required:false,action:'host'});}
    return {at:Date.now(),checks,canStream:checks.filter(c=>c.required).every(c=>c.ready),canHost:checks.filter(c=>['model','voice','chat-twitch'].includes(c.id)).every(c=>c.ready)} satisfies ReadinessReport;
  });
  handler('saveHostConfig',async value=>{await hosting.save(value);await applyLayouts();});
  handler('saveHostLayouts',async value=>{await hosting.saveLayouts(value);await applyLayouts();});
  handler('saveHostKey',value=>hosting.key(value));
  handler('importAvatar',async()=>{if(hosting.running)throw new Error('host.stopFirst');const r=await dialog.showOpenDialog(window,{properties:['openFile'],filters:[{name:'Avatar',extensions:['png','webp','jpg','jpeg','vrm']}]});if(r.canceled)return false;await hosting.importAsset(r.filePaths[0]);return true;});
  handler('startHost',()=>hosting.start());handler('stopHost',async()=>hosting.stop());
  handler('testHostVoice',async()=>{await hosting.testVoice();return overlay.audioURL();});
  handler('applyHostLayout',applyLayouts);handler('gamePreview',value=>obs.gamePreview(provider.parse(value)));
  handler('preview',value=>obs.preview(provider.parse(value)));
  handler('launchGame',()=>game.launch(),message('busy.game'));
  handler('setMode',value=>game.setMode(mode.parse(value)));
  handler('startStream',()=>broadcast.start(),message('busy.start'));
  handler('stopStream',()=>broadcast.stop(),message('busy.stop'));
  handler('openExternal',value=>shell.openExternal(allowedExternal(z.string().max(1500).parse(value))));
  if(dev) { if(dev!=='http://127.0.0.1:5173')throw new Error('Invalid development origin');await window.loadURL(dev); }
  else await window.loadFile(join(__dirname,'../../dist/index.html'));
  const icon=nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==').resize({width:16,height:16});
  tray=new Tray(icon);tray.setToolTip('JEV Studio');
  updateTray();
  tray.on('double-click',()=>window.show());
  window.on('close',event=>{if(!closing){event.preventDefault();window.hide();}});
  globalShortcut.register('CommandOrControl+Alt+M',()=>{void game.setMode('manual');window.show();});
  setInterval(()=>{void obs.poll().then(()=>broadcast.monitor());},2000).unref();
  setInterval(()=>{if(healthBusy)return;healthBusy=true;void (async()=>{for(const p of providers){let picture:{signature:string;black:boolean}|undefined;try{if(obs.states[p].active&&obs.states[p].connected){const image=nativeImage.createFromDataURL(await obs.gamePreview(p)).resize({width:48,height:27}).toBitmap();let sum=0,max=0;for(let i=0;i<image.length;i+=4){const value=(image[i]+image[i+1]+image[i+2])/3;sum+=value;max=Math.max(max,value);}picture={signature:createHash('sha256').update(image).digest('hex'),black:sum/Math.max(1,image.length/4)<3&&max<12};}}catch{}health.sample(p,obs.states[p],hosting.overlay[p],hosting.running,Date.now(),picture);}})().finally(()=>{healthBusy=false;});},10000).unref();
  setInterval(()=>{void auth.validateTwitch().catch(()=>log(message('event.twitchCheck')));},55*60*1000).unref();
  void auth.validateTwitch().catch(()=>log(message('event.twitchStartup')));
  log(message('event.started'));
});
app.on('second-instance',()=>{window?.show();window?.focus();});
app.on('before-quit',event=>{
  if(closing)return;event.preventDefault();
  void (async()=>{
    try {hosting?.stop();overlay?.close();await game?.close();if(broadcast && broadcast.state.state!=='idle')await broadcast.stop();closing=true;app.quit();}
    catch {window.show();await dialog.showMessageBox(window,{type:'warning',message:t(currentLocale,'error.quitStreaming')});}
  })();
});
