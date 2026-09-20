// ETC acceptance without OBS setup, OAuth, capture or streaming.
// Default: read-only compatibility probe. --run --matches 20: actual Steam bot matches.
const {_electron:electron}=require('playwright');
const path=require('node:path'),fs=require('node:fs/promises'),assert=require('node:assert/strict');
const {execFileSync,spawn}=require('node:child_process');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
(async()=>{
 const root=path.resolve(__dirname,'..'),run=process.argv.includes('--run'),launchRequested=run||process.argv.includes('--launch');
 const n=process.argv.indexOf('--matches'),count=n<0?1:Number(process.argv[n+1]);
 assert(Number.isInteger(count)&&count>=1&&count<=100,'--matches must be 1..100');
 const data=await fs.mkdtemp(path.join(process.env.LOCALAPPDATA,'JevAutoplayAcceptance-'));
 const env={...process.env,JEV_TEST_DATA_DIR:data};delete env.ELECTRON_RUN_AS_NODE;delete env.JEV_DEV_URL;
 const isolated=process.argv.includes('--isolated');
 if(isolated)env.JEV_TEST_ETC_BRIDGE_DIR=path.join(data,'etc-bridge');
 const packagedIndex=process.argv.indexOf('--packaged');
 const packaged=packagedIndex<0?undefined:path.resolve(process.argv[packagedIndex+1]);
 const app=await electron.launch({...(packaged?{executablePath:packaged,args:[]}:{args:[root]}),env,timeout:60000});const page=await app.firstWindow();
 const report={date:new Date().toISOString(),appId:'5272970',requestedMatches:run?count:0,streamingStarted:false,
  stage:'preflight',buildId:'',bridgeConnected:false,completedMatches:0,wins:0,observations:[],manualRelease:false};
 const out=path.join(root,'test-results',isolated?'etc-autoplay-'+Date.now():'etc-autoplay');await fs.mkdir(out,{recursive:true});
 report.isolatedBridge=isolated;console.log(JSON.stringify({output:out,bridgeDirectory:isolated?env.JEV_TEST_ETC_BRIDGE_DIR:undefined}));
 if(isolated&&!packaged)await app.evaluate(({app},{root,out})=>{
  const r=process.getBuiltinModule('module').createRequire(root+'/package.json'),fs=r('node:fs');
  const {EtcBridge}=r(root+'/dist-main/electron/etc-bridge.js'),read=EtcBridge.prototype.read;
  EtcBridge.prototype.read=async function(...args){const o=await read.apply(this,args);
   fs.appendFileSync(out+'/bridge-health.jsonl',JSON.stringify({at:Date.now(),accepted:!!o,reason:this.lastReadFailure,frame:o?.frame,phase:o?.phase,mode:o?.mode,epoch:o?.epoch,foreground:o?.foreground,room:o?.self.room,traveling:o?.self.traveling,stuck:o?.diagnostics.stuck,action:o?.diagnostics.lastAction})+'\n');return o;};
 },{root,out});
 try{
  await page.waitForSelector('.studio-grid');
  await page.evaluate(async count=>{
   const s=await window.studio.snapshot();await window.studio.saveSettings({...s.settings,decisionProvider:'rules',autoRestart:count>1,enabledPlatforms:[]});
   await window.studio.selectPlatforms([]);await window.studio.scanSteam();await window.studio.addSteamGame('5272970');await window.studio.selectSteamGame('5272970');
  },count);
  let s=await page.evaluate(()=>window.studio.snapshot());
  if(launchRequested&&isolated){
   assert(!s.gameConnected,'Isolated acceptance requires the Steam game to be closed before launching its private control channel');
   const registry=execFileSync('reg.exe',['query','HKCU\\Software\\Valve\\Steam','/v','SteamPath'],{windowsHide:true,encoding:'utf8'});
   const steamRoot=registry.match(/SteamPath\s+REG_SZ\s+(.+)/i)?.[1].trim();assert(steamRoot,'Steam installation missing');
   const launch=spawn(path.join(steamRoot,'steam.exe'),['-applaunch','5272970',`-JevBridgeDir=${env.JEV_TEST_ETC_BRIDGE_DIR}`],{windowsHide:true,stdio:'ignore'});
   await new Promise((resolve,reject)=>{launch.once('spawn',resolve);launch.once('error',reject);});launch.unref();
  }else if(launchRequested&&!s.gameConnected)await page.evaluate(()=>window.studio.launchGame());
  const until=Date.now()+(launchRequested?120000:7000);
  while(Date.now()<until){s=await page.evaluate(()=>window.studio.snapshot());if(s.autoplay.connected)break;await sleep(250);}
  report.buildId=s.selectedGame.buildId;report.bridgeConnected=s.autoplay.connected;report.gameProcessDetected=s.gameConnected;
  report.packaged=!!packaged;
  console.log(JSON.stringify({buildId:report.buildId,bridgeConnected:report.bridgeConnected,gameProcessDetected:report.gameProcessDetected,phase:s.game?.phase}));
  assert.equal(s.broadcast.state,'idle');assert(Object.values(s.outputs).every(o=>!o.active));
  const languages=['zh-CN','zh-TW','ja','ko','en'];report.languages=[];
  for(const locale of languages){
   await page.evaluate(value=>window.studio.setLocale(value),locale);
   await page.waitForFunction(value=>document.documentElement.lang===value,locale);
   const text=await page.locator('[data-testid="autoplay-metrics"]').innerText();
   assert(!/@jev:|etc\.metrics|etc\.latency/.test(text));report.languages.push(locale);
  }
  await page.evaluate(()=>window.studio.setLocale('zh-CN'));
  await page.waitForFunction(()=>document.documentElement.lang==='zh-CN');
  await page.screenshot({path:path.join(out,'studio.png'),fullPage:true});
  if(!s.autoplay.connected){
   report.stage='blocked-missing-game-api-v3';
   if(run)throw new Error('Installed Steam build has no connected ETC API v3; zero match acceptance claimed.');
   console.log(JSON.stringify({stage:report.stage,buildId:report.buildId,gameDetected:s.gameConnected,matches:0}));return;
  }
  report.stage='api-v3-connected';if(!run){console.log(JSON.stringify({stage:report.stage,buildId:report.buildId}));return;}
  await page.evaluate(()=>window.studio.setMode('auto'));
  const deadline=Date.now()+count*20*60*1000;
  while(Date.now()<deadline){
   await sleep(1000);s=await page.evaluate(()=>window.studio.snapshot());
   assert.equal(s.broadcast.state,'idle');assert(Object.values(s.outputs).every(o=>!o.active));
   report.observations.push({at:new Date().toISOString(),phase:s.game?.phase,mode:s.mode,nativeMode:s.game?.mode,gameError:s.gameError,foreground:s.gameInput.foreground,heldInputs:s.gameInput.heldInputs,ack:s.game?.ack,position:s.game?.position,...s.autoplay});
   report.completedMatches=s.autoplay.matches;report.wins=s.autoplay.wins;
   if(s.autoplay.matches>=count)break;
   assert.equal(s.mode,'auto','Autoplay stopped before requested full matches completed');
   if(report.observations.length%10===0)console.log(JSON.stringify({elapsed:report.observations.length,matches:s.autoplay.matches,wins:s.autoplay.wins,phase:s.game?.phase,...s.autoplay}));
  }
  assert.equal(report.completedMatches,count,'Not enough official match results');
  report.stage='completed';
 }catch(e){report.failure=e.message;if(report.stage==='api-v3-connected')report.stage='failed-autoplay';throw e;}finally{
  await page.evaluate(()=>window.studio.setMode('manual')).catch(()=>{});await sleep(600);
  const final=await page.evaluate(()=>window.studio.snapshot()).catch(()=>null);
  report.manualRequested=!!final&&final.mode==='manual';
  report.manualRelease=!!final&&final.autoplay.connected&&final.mode==='manual'&&final.game?.mode==='manual'&&final.gameInput.heldInputs===0;
  report.summary=final?.autoplay;
  await fs.writeFile(path.join(out,'acceptance.json'),JSON.stringify(report,null,2));
  await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{});
 }
})().catch(e=>{console.error(e.message);process.exitCode=1;});
