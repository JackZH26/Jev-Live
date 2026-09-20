// Isolated X configuration / IPC acceptance. Fixture credentials never reach a service.
const {_electron:electron}=require('playwright');
const path=require('node:path'),fs=require('node:fs/promises'),assert=require('node:assert/strict');
(async()=>{
 const root=path.resolve(__dirname,'..'),data=await fs.mkdtemp(path.join(process.env.LOCALAPPDATA,'JEV Studio XTest-'));
 const env={...process.env,JEV_TEST_DATA_DIR:data};delete env.ELECTRON_RUN_AS_NODE;delete env.JEV_DEV_URL;
 const app=await electron.launch({args:[root],env,timeout:60000});
 try{
  const page=await app.firstWindow();await page.waitForSelector('.studio-grid');
  assert.equal(await page.locator('.platform-toggle input').count(),3);
  await page.evaluate(()=>window.studio.selectPlatforms(['x']));
  await page.locator('.nav-item').nth(1).click();
  const form=page.locator('#x-settings'),inputs=form.locator('input');
  assert.equal(await inputs.nth(2).getAttribute('type'),'password');
  await inputs.nth(0).fill('Fixture X source');await inputs.nth(1).fill('rtmps://example.org/invalid');await inputs.nth(2).fill('fixture-only-stream-key');
  await form.locator('.primary-button').click();await page.waitForFunction(()=>document.querySelector('[role=alert]')?.textContent.includes('RTMP'));
  assert.equal(await inputs.nth(2).inputValue(),'');
  assert(!(await page.locator('[role=alert]').innerText()).includes('fixture-only-stream-key'));
  assert.equal((await page.evaluate(()=>window.studio.snapshot())).xSource.configured,false);
  await inputs.nth(1).fill('rtmps://sg.pscp.tv:443/x/fixture');await inputs.nth(2).fill('fixture-only-stream-key');
  await form.locator('.primary-button').click();await page.waitForFunction(async()=> (await window.studio.snapshot()).xSource.configured);
  assert.equal(await inputs.nth(2).inputValue(),'');assert.equal(await inputs.nth(1).inputValue(),'');
  const saved=await page.evaluate(()=>window.studio.snapshot());
  assert.deepEqual(saved.xSource,{configured:true,name:'Fixture X source'});
  assert(!JSON.stringify(saved).includes('fixture-only-stream-key'));assert(!JSON.stringify(saved).includes('sg.pscp.tv'));
  assert(!(await fs.readFile(path.join(data,'vault.bin'))).includes(Buffer.from('fixture-only-stream-key')));
  assert.deepEqual(saved.settings.enabledPlatforms,['x']);assert(!saved.accounts.youtube&&!saved.accounts.twitch);
  await app.evaluate(async({app,safeStorage},root)=>{
   const r=process.getBuiltinModule('module').createRequire(root+'/package.json');
   const {Store}=r(root+'/dist-main/electron/storage.js'),{Game}=r(root+'/dist-main/electron/game.js'),{Obs}=r(root+'/dist-main/electron/obs.js');
   const store=new Store(app.getPath('userData'),safeStorage);
   Object.defineProperty(Game.prototype,'selected',{get:()=>({appId:'5272970',name:'Fixture Steam game',autoSupport:'experimental'})});
   Obs.prototype.setup=async function(){Object.assign(this.states.x,{connected:true,ready:true});};
   Obs.prototype.poll=async()=>{};Obs.prototype.windows=async()=>[{value:'fixture-window'}];Obs.prototype.preview=async()=>'';
   Obs.prototype.service=async()=>{};Obs.prototype.start=async function(p){this.states[p].active=true;};Obs.prototype.stop=async function(p){this.states[p].active=false;};Obs.prototype.clearKey=async()=>{};
   await store.saveSettings({...await store.settings(),steamAppId:'5272970',addedSteamGames:['5272970'],gameWindow:'fixture-window'});
   globalThis.fetch=async()=>{throw new Error('X source flow must not call OAuth or platform APIs');};
  },root);
  await page.evaluate(()=>window.studio.setupOBS());await page.locator('.nav-item').first().click();
  await page.waitForFunction(()=>!document.querySelector('.live-card .primary-button').disabled);
  await page.locator('.live-card .primary-button').click();await page.waitForFunction(async()=> (await window.studio.snapshot()).broadcast.state==='sending');
  const denied=await page.evaluate(()=>window.studio.removeXSource().then(()=>'',e=>e.message));assert(denied.includes('error.livePending'));
  await page.evaluate(()=>window.studio.stopStream());await page.evaluate(()=>window.studio.removeXSource());
  assert.equal((await page.evaluate(()=>window.studio.snapshot())).xSource.configured,false);
  console.log(JSON.stringify({xOnlyWithoutOAuth:true,encrypted:true,noSnapshotSecrets:true,formCleared:true,invalidHostRejected:true,removalLockedDuringOutput:true,realBroadcasts:0}));
 }finally{await app.evaluate(({app})=>app.quit()).catch(()=>{});await app.close().catch(()=>{});}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
