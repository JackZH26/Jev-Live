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
import type { Snapshot } from '../shared/types';

app.setName('JEV Studio');
// Keep an isolated test workspace from claiming the installed application's lock.
if(process.env.JEV_TEST_DATA_DIR)app.setPath('userData',process.env.JEV_TEST_DATA_DIR);
if(!app.requestSingleInstanceLock()) app.quit();
let window:BrowserWindow, tray:Tray, closing=false, busy='',lastError='';
let store:Store,auth:OAuth,obs:Obs,game:Game,broadcast:Broadcast;
let currentLocale:Locale='zh-CN';
const logs:Snapshot['logs']=[];
const log=(message:string)=>{logs.unshift({at:new Date().toISOString(),message});logs.splice(0,logs.length,...logs.slice(0,100));};
function updateTray(){if(tray)tray.setContextMenu(Menu.buildFromTemplate([{label:t(currentLocale,'tray.open'),click:()=>window.show()},{label:t(currentLocale,'tray.manual'),click:()=>{void game.setMode('manual');}},{type:'separator'},{label:t(currentLocale,'tray.quit'),click:()=>app.quit()}]));}
const provider=z.enum(['youtube','twitch']);
const mode=z.enum(['manual','auto']);
const dev=process.env.JEV_DEV_URL;

function handler(name:string,fn:(arg:any)=>Promise<any>,operation?:string) {
  ipcMain.handle(`studio:${name}`,async(event,arg)=>{
    if(event.sender!==window.webContents || event.senderFrame!==window.webContents.mainFrame) throw new Error('Unauthorized caller');
    if(operation && busy) return {ok:false,error:message('error.busy')};
    if(operation)busy=operation;
    try { const data=await fn(arg);return {ok:true,data}; }
    catch(e) { const errorText=e instanceof Error?e.message:message('error.generic');lastError=errorText.slice(0,500);log(lastError);return {ok:false,error:lastError}; }
    finally {if(operation)busy='';}
  });
}
function allowedExternal(raw:string) {
  const u=new URL(raw);
  if(u.protocol!=='https:' || u.port || u.username || u.password || !['www.youtube.com','studio.youtube.com','www.twitch.tv','dev.twitch.tv','console.cloud.google.com','docs.typesafe.ai','developers.google.com','x.com'].includes(u.hostname))throw new Error(message('error.external'));
  return u.href;
}

app.whenReady().then(async()=>{
  const directory=process.env.JEV_TEST_DATA_DIR || app.getPath('userData');
  store=new Store(directory,safeStorage);await store.init();
  currentLocale=(await store.settings()).locale;
  const steam=new Steam(url=>shell.openExternal(url));
  auth=new OAuth(store,url=>shell.openExternal(url),log);obs=new Obs(store,log);game=new Game(store,log,steam,join(app.isPackaged?process.resourcesPath:app.getAppPath(),'dist-native','SteamObserver.exe'));
  broadcast=new Broadcast(store,obs,auth,new Platforms(auth),log);await game.init();await broadcast.init();
  window=new BrowserWindow({width:1480,height:960,minWidth:1080,minHeight:720,backgroundColor:'#f2f3f8',title:'JEV Studio',autoHideMenuBar:true,webPreferences:{preload:join(__dirname,'preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true}});
  window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  window.webContents.on('will-navigate',(event)=>event.preventDefault());
  window.webContents.session.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));
  window.webContents.session.setPermissionCheckHandler(()=>false);
  handler('snapshot',async()=>({settings:await store.settings(),accounts:await auth.accounts(),outputs:obs.states,mode:game.gate.mode,game:game.connected?game.state:null,gameConnected:game.connected,gameError:game.error,gamePid:game.pid,decision:game.decision,busy,lastError,hasJevKey:!!await store.get('jev.key'),auth:auth.status,logs,broadcast:broadcast.state,steamGames:steam.games,selectedGame:game.selected,decisionStats:game.decisionStats,gameInput:{foreground:game.observation?.foreground??false,heldInputs:game.observation?.heldInputs??0}} satisfies Snapshot));
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
  handler('connectAccount',async value=>{await auth.login(provider.parse(value));});
  handler('cancelLogin',async value=>auth.cancel(provider.parse(value)));
  handler('disconnectAccount',async value=>{if(broadcast.state.state!=='idle')throw new Error(message('error.logoutDuringLive'));await auth.disconnect(provider.parse(value));});
  handler('setupOBS',()=>obs.setup(),message('busy.obs'));
  handler('windows',()=>obs.windows());handler('setCapture',value=>obs.capture(z.string().min(1).max(1000).parse(value)),message('busy.capture'));
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
  setInterval(()=>{void obs.poll();},2000).unref();
  setInterval(()=>{void auth.validateTwitch().catch(()=>log(message('event.twitchCheck')));},55*60*1000).unref();
  void auth.validateTwitch().catch(()=>log(message('event.twitchStartup')));
  log(message('event.started'));
});
app.on('second-instance',()=>{window?.show();window?.focus();});
app.on('before-quit',event=>{
  if(closing)return;event.preventDefault();
  void (async()=>{
    try {await game?.close();if(broadcast && broadcast.state.state!=='idle')await broadcast.stop();closing=true;app.quit();}
    catch {window.show();await dialog.showMessageBox(window,{type:'warning',message:t(currentLocale,'error.quitStreaming')});}
  })();
});
