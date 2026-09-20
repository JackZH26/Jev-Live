// Isolated UI/IPC regression: simulated game/outputs and rejected YouTube API, no live services.
const {_electron:electron}=require('playwright');
const path=require('node:path'),fs=require('node:fs/promises'),assert=require('node:assert/strict');
(async()=>{
 const root=path.resolve(__dirname,'..'),data=await fs.mkdtemp(path.join(process.env.LOCALAPPDATA,'JEV Studio PlatformTest-'));
 const env={...process.env,JEV_TEST_DATA_DIR:data};delete env.ELECTRON_RUN_AS_NODE;delete env.JEV_DEV_URL;
 const app=await electron.launch({args:[root],env,timeout:60000});
 try{
  const page=await app.firstWindow();await page.waitForSelector('.studio-grid');
  await app.evaluate(async({app,safeStorage,shell},root)=>{
   const r=process.getBuiltinModule('module').createRequire(root+'/package.json');
   const {Store}=r(root+'/dist-main/electron/storage.js'),{Game}=r(root+'/dist-main/electron/game.js'),{Obs}=r(root+'/dist-main/electron/obs.js'),{OAuth}=r(root+'/dist-main/electron/oauth.js');
   const store=new Store(app.getPath('userData'),safeStorage);globalThis.platformTestStore=store;
   Game.prototype.tick=async()=>{};Game.prototype.setMode=async function(mode){this.gate.change(mode);};
   Object.defineProperty(Game.prototype,'selected',{get:()=>({appId:'5272970',name:'Fixture Steam game',autoSupport:'experimental'})});
   OAuth.prototype.accounts=async()=>({youtube:{id:'fixture',name:'Fixture YouTube',connected:true},twitch:{id:'fixture',name:'Fixture Twitch',connected:true}});
   OAuth.prototype.validateTwitch=async()=>{};OAuth.prototype.credentials=async()=>({access_token:'fixture'});
   Obs.prototype.setup=async function(){for(const p of ['youtube','twitch'])Object.assign(this.states[p],{connected:true,ready:true});};
   Obs.prototype.poll=async()=>{};Obs.prototype.windows=async()=>[{value:'fixture-window'}];
   Obs.prototype.preview=async()=>'';Obs.prototype.stop=async()=>{};Obs.prototype.clearKey=async()=>{};
   globalThis.platformTestStarts=0;Obs.prototype.start=async()=>{globalThis.platformTestStarts++;throw new Error('Unexpected output start');};
   globalThis.fetch=async url=>{if(!String(url).startsWith('https://www.googleapis.com/youtube/v3/liveBroadcasts?'))throw new Error('Unexpected external request');return new Response(JSON.stringify({error:{errors:[{reason:'livePermissionBlocked'}]}}),{status:403});};
   shell.openExternal=async url=>{globalThis.platformTestOpened=url;};
   await store.saveSettings({...await store.settings(),steamAppId:'5272970',addedSteamGames:['5272970'],gameWindow:'fixture-window'});
  },root);
  await page.evaluate(async()=>{await window.studio.setupOBS();await window.studio.setMode('auto');});
  await page.waitForFunction(async()=> (await window.studio.snapshot()).mode==='auto');
  await page.waitForTimeout(1100);
  const checkboxes=page.locator('.platform-toggle input');const stale=(await page.evaluate(()=>window.studio.snapshot())).settings;
  const waitSelection=platforms=>page.waitForFunction(async expected=>JSON.stringify((await window.studio.snapshot()).settings.enabledPlatforms)===JSON.stringify(expected),platforms);
  await checkboxes.first().uncheck();await waitSelection(['twitch']);await checkboxes.nth(1).uncheck();await waitSelection([]);
  assert.deepEqual((await page.evaluate(()=>window.studio.snapshot())).settings.enabledPlatforms,[]);
  assert.equal((await page.evaluate(()=>window.studio.snapshot())).mode,'auto');
  assert(await page.locator('.live-card .primary-button').isDisabled());
  const noPlatforms=await page.evaluate(()=>window.studio.startStream().then(()=>'',e=>e.message));assert(noPlatforms.includes('channels.minimum'));
  await page.evaluate(()=>window.studio.setMode('manual'));await page.evaluate(settings=>window.studio.saveSettings(settings),stale);
  assert.deepEqual((await page.evaluate(()=>window.studio.snapshot())).settings.enabledPlatforms,[]);
  await page.evaluate(()=>window.studio.setMode('auto'));
  await checkboxes.first().check();await waitSelection(['youtube']);await checkboxes.nth(1).check();await waitSelection(['youtube','twitch']);
  assert.equal((await page.evaluate(()=>window.studio.snapshot())).settings.gameWindow,'');
  await app.evaluate(async()=>{const store=globalThis.platformTestStore;await store.saveSettings({...await store.settings(),gameWindow:'fixture-window'});});
  await page.waitForFunction(()=>!document.querySelector('.live-card .primary-button').disabled);
  for(const locale of ['zh-CN','zh-TW','ja','ko','en']){
   await page.selectOption('#language',locale);await page.waitForFunction(l=>document.documentElement.lang===l,locale);
   await page.locator('.live-card .primary-button').click();await page.waitForSelector('.notice-action');
   const text=await page.locator('[role=alert]').innerText();assert(text.includes('YouTube')&&text.includes('Twitch')&&text.includes('livePermissionBlocked'));assert(!text.includes('@jev:'));
   assert.equal((await page.evaluate(()=>window.studio.snapshot())).broadcast.state,'idle');
   assert.deepEqual((await page.evaluate(()=>window.studio.snapshot())).settings.enabledPlatforms,['youtube','twitch']);
  }
  await page.locator('.notice-action').click();assert.equal(await app.evaluate(()=>globalThis.platformTestOpened),'https://studio.youtube.com/');
  assert.equal(await app.evaluate(()=>globalThis.platformTestStarts),0);
  await app.evaluate(({},root)=>{const r=process.getBuiltinModule('module').createRequire(root+'/package.json');r(root+'/dist-main/electron/broadcast.js').Broadcast.prototype.start=async function(){this.state={state:'sending',platforms:['youtube','twitch']};};},root);
  await page.evaluate(()=>window.studio.startStream());await page.waitForFunction(()=>document.querySelector('.platform-toggle input').disabled);
  const locked=await page.evaluate(()=>window.studio.selectPlatforms([]).then(()=>'',e=>e.message));assert(locked.includes('error.livePending'));
  await page.evaluate(()=>window.studio.stopStream());
  console.log(JSON.stringify({isolatedFixtures:true,autoModeCheckboxes:true,emptySelectionBlockedAtStart:true,staleSettingsPreserved:true,newOutputRequiresCapture:true,localizedYouTubeError:5,officialStudioLink:true,liveSelectionLocked:true,realBroadcasts:0}));
 }finally{await app.evaluate(({app})=>app.quit()).catch(()=>{});await app.close().catch(()=>{});}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
