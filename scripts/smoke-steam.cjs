// Explicit local acceptance. Launches only the selected Steam Playtest and tests its bot match.
const {_electron:electron}=require('playwright');
const path=require('node:path'),fs=require('node:fs/promises');
const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const root=path.resolve(__dirname,'..'),env={...process.env,JEV_TEST_DATA_DIR:path.join(process.env.LOCALAPPDATA,'JEV Studio DevTest')};
 delete env.ELECTRON_RUN_AS_NODE;delete env.JEV_DEV_URL;
 const app=await electron.launch({args:[root],env,timeout:60000}),page=await app.firstWindow();
 const report={steam:true,appId:'5272970',observations:[],manualHandover:false,dualCapture:false};
 const jev=process.argv.includes('--jev');
 try{
  await page.waitForSelector('.studio-grid');
  const games=await page.evaluate(()=>window.studio.scanSteam());assert(games.some(g=>g.appId==='5272970'));
  await page.evaluate(async()=>{await window.studio.setMode('manual');const s=await window.studio.snapshot();await window.studio.saveSettings({...s.settings,decisionProvider:'rules'});await window.studio.addSteamGame('5272970');await window.studio.selectSteamGame('5272970');await window.studio.launchGame();});
  if(jev){
   // Explicit test reuse of this Windows user's existing DPAPI-protected JEV key.
   // Decryption travels through a private subprocess pipe into safeStorage only.
   await app.evaluate(async({safeStorage},root)=>{
    const r=process.getBuiltinModule('module').createRequire(root+'/package.json');
    const {Store}=r(root+'/dist-main/electron/storage.js');
    const key=r('node:child_process').execFileSync('powershell.exe',['-NoProfile','-Command',"$p=Join-Path $env:LOCALAPPDATA 'JevBrowserOperator\\typesafe-api-key.dpapi'; $s=ConvertTo-SecureString ([IO.File]::ReadAllText($p)); [Console]::Write([System.Net.NetworkCredential]::new('', $s).Password)"],{windowsHide:true,encoding:'utf8',stdio:['ignore','pipe','ignore']});
    const store=new Store(process.env.JEV_TEST_DATA_DIR,safeStorage);await store.set('jev.key',key);
   },root);
   await page.evaluate(async()=>{const s=await window.studio.snapshot();await window.studio.saveSettings({...s.settings,decisionProvider:'jev',decisionIntervalMs:1500,autoRestart:true});});
  }
  const deadline=Date.now()+120000;while(!(await page.evaluate(()=>window.studio.snapshot())).gameConnected){if(Date.now()>deadline)throw new Error('Steam game window did not connect');await pause(500);}
  await page.evaluate(()=>window.studio.setupOBS());
  const windows=await page.evaluate(()=>window.studio.windows()),target=windows.find(w=>/LyraGame-Win64-Shipping\.exe/i.test(w.value));assert(target,'Steam Shipping game window is missing');
  await page.evaluate(value=>window.studio.setCapture(value),target.value);report.dualCapture=true;
  const before=await page.evaluate(()=>window.studio.preview('youtube'));
  await fs.mkdir(path.join(root,'test-results'),{recursive:true});await fs.writeFile(path.join(root,'test-results','steam-before.jpg'),Buffer.from(before.split(',')[1],'base64'));
  await page.evaluate(()=>window.studio.setMode('auto'));
  for(let i=0;i<(jev?25:60);i++){
   await pause(1000);const s=await page.evaluate(()=>window.studio.snapshot());
   report.observations.push({phase:s.game?.phase,ack:s.game?.ack,action:s.game?.lastAction,mode:s.mode,decision:s.decision,error:s.gameError,jev:s.decisionStats});
   if(i%10===0)console.log(JSON.stringify({elapsed:i,...report.observations.at(-1)}));
  }
  const after=await page.evaluate(()=>window.studio.preview('youtube'));await fs.writeFile(path.join(root,'test-results','steam-after.jpg'),Buffer.from(after.split(',')[1],'base64'));
  // Reject a leftover solid test overlay; binding a source alone does not prove visible capture.
  const colors=await app.evaluate(({nativeImage},url)=>{const picture=nativeImage.createFromBuffer(Buffer.from(url.split(',')[1],'base64')),pixels=picture.toBitmap(),unique=new Set();for(let i=0;i<pixels.length;i+=4*503)unique.add(pixels.subarray(i,i+3).toString('hex'));return unique.size;},after);
  assert(colors>20,'Game output is a flat frame or test pattern');
  const gamePid=(await page.evaluate(()=>window.studio.snapshot())).gamePid;assert(Number.isInteger(gamePid));
  const showGame=command=>execFileSync('powershell.exe',['-NoProfile','-Command',`Add-Type -TypeDefinition 'using System;using System.Runtime.InteropServices;public class TestWindow{[DllImport("user32.dll")]public static extern bool ShowWindow(IntPtr h,int c);}'; $target=Get-Process -Id ${gamePid}; [void][TestWindow]::ShowWindow($target.MainWindowHandle,${command})`],{windowsHide:true,stdio:'ignore'});
  showGame(6);
  await pause(2000);const unfocused=await page.evaluate(()=>window.studio.snapshot());await pause(2000);const still=await page.evaluate(()=>window.studio.snapshot());
  assert(!still.gameInput.foreground&&still.gameInput.heldInputs===0,'Focus loss must release game input');assert.equal(still.game?.ack,unfocused.game?.ack,'No action may execute in another window');
  await page.evaluate(()=>window.studio.setMode('manual'));showGame(9);await pause(1800);
  const final=await page.evaluate(()=>window.studio.snapshot());report.manualHandover=final.mode==='manual'&&final.game?.mode==='manual'&&final.gameInput.heldInputs===0;report.focusGuard=true;report.frameColors=colors;
  await fs.writeFile(path.join(root,'test-results',jev?'steam-jev-acceptance.json':'steam-acceptance.json'),JSON.stringify(report,null,2));
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].show());
  await page.screenshot({path:path.join(root,'test-results','steam-studio.png'),fullPage:true});
  assert(report.manualHandover,'Manual handover failed');
  if(jev)assert(final.decisionStats.jevResponses>0,'No real JEV response was accepted');
  assert(report.observations.some(s=>s.phase==='playing'&&s.ack>3),'No accepted gameplay actions');
  console.log(JSON.stringify({steamLibrary:games.length,appId:'5272970',actualShippingWindow:true,dualCapture:true,acceptedActions:final.game?.ack,manualHandover:report.manualHandover}));
 }finally{await page.evaluate(()=>window.studio.setMode('manual')).catch(()=>{});await app.evaluate(({app})=>app.quit());await app.close().catch(()=>{});}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
