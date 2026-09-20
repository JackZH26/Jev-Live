const {_electron:electron}=require('playwright');
const path=require('node:path'),fs=require('node:fs/promises'),assert=require('node:assert/strict');
(async()=>{
 const root=path.resolve(__dirname,'..'),data=await fs.mkdtemp(path.join(process.env.LOCALAPPDATA,'JEV Studio PackageTest-'));
 const env={...process.env,JEV_TEST_DATA_DIR:data};delete env.ELECTRON_RUN_AS_NODE;delete env.JEV_DEV_URL;
 const app=await electron.launch({executablePath:process.env.JEV_PACKAGE_EXE||path.join(root,'release','win-unpacked','JEV Studio.exe'),args:[],env,timeout:60000});
 try{
  const page=await app.firstWindow();await page.waitForSelector('.studio-grid');
  const poll=async condition=>{const end=Date.now()+20000;do{const snapshot=await page.evaluate(()=>window.studio.snapshot());if(condition(snapshot))return snapshot;await new Promise(r=>setTimeout(r,200));}while(Date.now()<end);throw new Error('Packaged Steam state did not become ready');};
  assert(await app.evaluate(({app})=>app.isPackaged));assert.equal(await page.evaluate(()=>typeof window.require),'undefined');
  const games=await page.evaluate(()=>window.studio.scanSteam());assert(games.some(g=>g.appId==='5272970'));
  await page.locator('.game-card .text-button').click();await page.waitForSelector('.library-dialog');
  await page.locator('.library-game').filter({hasText:'Enter the Cube Playtest'}).locator('button').click();
  await poll(s=>s.settings.steamAppId==='5272970'&&s.selectedGame);
  await page.locator('.library-dialog .section-title button').click();
  const s=await poll(s=>s.gameConnected);assert.equal(s.mode,'manual');assert.equal(s.selectedGame?.name,'Enter the Cube Playtest');
  await fs.mkdir(path.join(root,'test-results'),{recursive:true});await page.screenshot({path:path.join(root,'test-results','packaged-steam.png'),fullPage:true});
  console.log(JSON.stringify({packaged:true,steamLibrary:games.length,addedViaUI:true,selectedGame:s.selectedGame.name,nativeHelper:true,mode:s.mode,rendererIsolated:true}));
 }finally{await app.evaluate(({app})=>app.quit());await app.close().catch(()=>{});}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
