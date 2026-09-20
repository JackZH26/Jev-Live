import { app, BrowserWindow, ipcMain, safeStorage, shell, dialog, Tray, Menu, nativeImage, globalShortcut } from 'electron';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { Store, settingsSchema } from './storage';
import { OAuth } from './oauth';
import { Obs } from './obs';
import { Game } from './game';
import { Platforms } from './platforms';
import { Broadcast } from './broadcast';
import type { Snapshot } from '../shared/types';

app.setName('JEV Studio');
if(!app.requestSingleInstanceLock()) app.quit();
let window:BrowserWindow, tray:Tray, closing=false, busy='',lastError='';
let store:Store,auth:OAuth,obs:Obs,game:Game,broadcast:Broadcast;
const logs:Snapshot['logs']=[];
const log=(message:string)=>{logs.unshift({at:new Date().toLocaleTimeString('zh-CN'),message});logs.splice(0,logs.length,...logs.slice(0,100));};
const provider=z.enum(['youtube','twitch']);
const mode=z.enum(['manual','auto']);
const dev=process.env.JEV_DEV_URL;

function handler(name:string,fn:(arg:any)=>Promise<any>,operation?:string) {
  ipcMain.handle(`studio:${name}`,async(event,arg)=>{
    if(event.sender!==window.webContents || event.senderFrame!==window.webContents.mainFrame) throw new Error('Unauthorized caller');
    if(operation && busy) return {ok:false,error:'另一个操作正在执行，请稍候。'};
    if(operation)busy=operation;
    try { const data=await fn(arg);return {ok:true,data}; }
    catch(e) { const message=e instanceof Error?e.message:'操作失败，请稍后重试。';lastError=message.slice(0,500);log(lastError);return {ok:false,error:lastError}; }
    finally {if(operation)busy='';}
  });
}
function allowedExternal(raw:string) {
  const u=new URL(raw);
  if(u.protocol!=='https:' || u.port || u.username || u.password || !['www.youtube.com','studio.youtube.com','www.twitch.tv','dev.twitch.tv','console.cloud.google.com','docs.typesafe.ai','developers.google.com'].includes(u.hostname))throw new Error('只能打开指定平台的官方网页。');
  return u.href;
}

app.whenReady().then(async()=>{
  const directory=process.env.JEV_TEST_DATA_DIR || app.getPath('userData');
  store=new Store(directory,safeStorage);await store.init();
  auth=new OAuth(store,url=>shell.openExternal(url),log);obs=new Obs(store,log);game=new Game(store,log);
  broadcast=new Broadcast(store,obs,auth,new Platforms(auth),log);await game.init();await broadcast.init();
  window=new BrowserWindow({width:1480,height:960,minWidth:1080,minHeight:720,backgroundColor:'#f2f3f8',title:'JEV Studio',autoHideMenuBar:true,webPreferences:{preload:join(__dirname,'preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true}});
  window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  window.webContents.on('will-navigate',(event)=>event.preventDefault());
  window.webContents.session.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));
  window.webContents.session.setPermissionCheckHandler(()=>false);
  handler('snapshot',async()=>({settings:await store.settings(),accounts:await auth.accounts(),outputs:obs.states,mode:game.gate.mode,game:game.connected?game.state:null,gameConnected:game.connected,gameError:game.error,gamePid:game.pid,decision:game.decision,busy,lastError,hasJevKey:!!await store.get('jev.key'),auth:auth.status,logs,broadcast:broadcast.state} satisfies Snapshot));
  handler('saveSettings',async value=>{
    const next=settingsSchema.parse(value),old=await store.settings();
    if(auth.pending.size)throw new Error('登录进行中，请完成或取消后再保存设置。');
    if(broadcast.state.state!=='idle' || game.gate.mode==='auto')throw new Error('请先结束直播并切到手动模式，再修改运行设置。');
    if(next.googleClientId!==old.googleClientId) {await store.set('oauth.youtube',undefined);await store.set('google.clientSecret',undefined);}
    if(next.twitchClientId!==old.twitchClientId)await store.set('oauth.twitch',undefined);
    await store.saveSettings(next);
  });
  handler('saveJevKey',async value=>{const key=z.string().trim().min(8).max(4096).parse(value);await store.set('jev.key',key);log('JEV API Key 已保存到系统加密存储。');});
  handler('importGoogleClient',async()=>{
    if(auth.pending.size || broadcast.state.state!=='idle')throw new Error('请先完成登录或结束直播。');
    const result=await dialog.showOpenDialog(window,{title:'导入 Google Desktop OAuth 客户端 JSON',properties:['openFile'],filters:[{name:'Google OAuth JSON',extensions:['json']}]});
    if(result.canceled)return false;
    const raw=JSON.parse(await readFile(result.filePaths[0],'utf8'));
    const c=z.object({client_id:z.string().endsWith('.apps.googleusercontent.com'),client_secret:z.string().optional()}).parse(raw.installed);
    await store.set('google.clientSecret',c.client_secret);await store.set('oauth.youtube',undefined);
    await store.saveSettings({...await store.settings(),googleClientId:c.client_id});return true;
  });
  handler('connectAccount',async value=>{await auth.login(provider.parse(value));});
  handler('cancelLogin',async value=>auth.cancel(provider.parse(value)));
  handler('disconnectAccount',async value=>{if(broadcast.state.state!=='idle')throw new Error('请先结束直播再退出平台账号。');await auth.disconnect(provider.parse(value));});
  handler('setupOBS',()=>obs.setup(),'正在准备两路 OBS');
  handler('windows',()=>obs.windows());handler('setCapture',value=>obs.capture(z.string().min(1).max(1000).parse(value)),'正在设置游戏画面');
  handler('preview',value=>obs.preview(provider.parse(value)));
  handler('launchGame',()=>game.launch(),'正在启动 ETC');
  handler('setMode',value=>game.setMode(mode.parse(value)));
  handler('startStream',()=>broadcast.start(),'正在启动双路直播');
  handler('stopStream',()=>broadcast.stop(),'正在结束双路直播');
  handler('openExternal',value=>shell.openExternal(allowedExternal(z.string().max(1500).parse(value))));
  if(dev) { if(dev!=='http://127.0.0.1:5173')throw new Error('Invalid development origin');await window.loadURL(dev); }
  else await window.loadFile(join(__dirname,'../../dist/index.html'));
  const icon=nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==').resize({width:16,height:16});
  tray=new Tray(icon);tray.setToolTip('JEV Studio');
  tray.setContextMenu(Menu.buildFromTemplate([{label:'打开 JEV Studio',click:()=>window.show()},{label:'立即切回手动游戏',click:()=>{void game.setMode('manual');}},{type:'separator'},{label:'结束直播并退出',click:()=>app.quit()}]));
  tray.on('double-click',()=>window.show());
  window.on('close',event=>{if(!closing){event.preventDefault();window.hide();}});
  globalShortcut.register('CommandOrControl+Alt+M',()=>{void game.setMode('manual');window.show();});
  setInterval(()=>{void obs.poll();},2000).unref();
  setInterval(()=>{void auth.validateTwitch().catch(()=>log('Twitch 授权检查暂时失败，下次检查会重试。'));},55*60*1000).unref();
  void auth.validateTwitch().catch(()=>log('Twitch 启动时授权检查失败，请在开播前重新检查账号。'));
  log('JEV Studio 已启动。先连接账号，准备 OBS，再检查游戏画面。');
});
app.on('second-instance',()=>{window?.show();window?.focus();});
app.on('before-quit',event=>{
  if(closing)return;event.preventDefault();
  void (async()=>{
    try {await game?.close();if(broadcast && broadcast.state.state!=='idle')await broadcast.stop();closing=true;app.quit();}
    catch {window.show();await dialog.showMessageBox(window,{type:'warning',message:'尚未确认全部推流停止。请先检查两路 OBS，再退出。'});}
  })();
});
