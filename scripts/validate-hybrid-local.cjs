// Local packaged acceptance only. This is explicitly NOT evidence of Steam installation.
const fs=require('node:fs/promises'),path=require('node:path'),{createHash}=require('node:crypto'),{spawn,execFileSync}=require('node:child_process');
const {app,safeStorage}=require('electron');const root=path.resolve(__dirname,'..');
const arg=(name,fallback)=>{const i=process.argv.indexOf(name);return i<0?fallback:process.argv[i+1];};
const release=arg('--candidate','');
const seconds=Number(arg('--seconds','1800')),requestBudget=Number(arg('--requests','1200'));
const requestedMatches=Number(arg('--matches','1'));
const live=process.argv.includes('--live');
const {RehearsalFocus}=require('./rehearsal-focus.cjs'),focusGate=new RehearsalFocus();
const cloud=process.argv.includes('--jev');process.env.TYPESAFE_LOG_LEVEL='off';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let control,report={kind:'packaged-engineering-smoke-NOT-Steam-install',provider:cloud?'jev':'rules',startedAt:new Date().toISOString(),samples:[],events:[],cloudCalls:[],polls:[]},out,child,secret;
app.disableHardwareAcceleration();app.whenReady().then(async()=>{
 const artifact=JSON.parse(await fs.readFile(path.join(release,'artifact.json'),'utf8'));
 if(!path.isAbsolute(release)||!Number.isInteger(seconds)||seconds<10||seconds>3600||!Number.isInteger(requestBudget)||requestBudget<1||requestBudget>2400||!Number.isInteger(requestedMatches)||requestedMatches<1||requestedMatches>20)throw Error('invalid_test_arguments');
 report.requestedMatches=requestedMatches;report.officialResults=[];report.liveDemonstration=live;
 report.candidate=artifact.release;report.requestedSeconds=seconds;report.requestBudget=requestBudget;report.runtimeHashes={};
 for(const name of ['etc-autoplay','etc-policy','etc-tactics','etc-recovery','etc-bridge','etc-map','etc-knowledge'])report.runtimeHashes[name]=createHash('sha256').update(await fs.readFile(path.join(root,'dist-main/electron',name+'.js'))).digest('hex');
 report.harnessHash=createHash('sha256').update(await fs.readFile(__filename)).digest('hex');
 report.focusHelperHash=createHash('sha256').update(await fs.readFile(path.join(__dirname,'focus-etc-candidate.ps1'))).digest('hex');
 report.releaseHelperHash=createHash('sha256').update(await fs.readFile(path.join(__dirname,'verify-manual-release.cjs'))).digest('hex');
 report.rehearsalFocusHash=createHash('sha256').update(await fs.readFile(path.join(__dirname,'rehearsal-focus.cjs'))).digest('hex');
 const exe=path.join(release,'content',artifact.config.executable),digest=createHash('sha256').update(await fs.readFile(exe)).digest('hex');
 if(artifact.config.app_id!==5272970||digest!==artifact.files.find(f=>f.path===artifact.config.executable)?.sha256)throw Error('artifact_identity');
 const data=await fs.mkdtemp(path.join(process.env.LOCALAPPDATA,'JevHybridSmoke-'));app.setPath('userData',data);process.env.JEV_TEST_DATA_DIR=data;
 out=path.join(root,'test-results','hybrid-smoke-'+Date.now());await fs.mkdir(out,{recursive:true});
 const dir=path.join(data,'etc-bridge');
 const {EtcBridge}=require('../dist-main/electron/etc-bridge');const {EtcAutoplay}=require('../dist-main/electron/etc-autoplay');const {Store,settingsSchema}=require('../dist-main/electron/storage');
 const store=new Store(data,safeStorage);await store.init();const settings=settingsSchema.parse({decisionProvider:cloud?'jev':'rules',decisionIntervalMs:2500,autoRestart:requestedMatches>1});
 if(cloud){const desktop=new Store(path.join(process.env.APPDATA,'JEV Studio'),safeStorage);try{secret=await desktop.get('jev.key');}catch{}
 if(!secret)secret=execFileSync('powershell.exe',['-NoProfile','-Command',"$p=Join-Path $env:LOCALAPPDATA 'JevBrowserOperator/typesafe-api-key.dpapi'; $s=ConvertTo-SecureString ([IO.File]::ReadAllText($p)); [Console]::Write([System.Net.NetworkCredential]::new('', $s).Password)"],{windowsHide:true,encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();
 if(!secret)throw Error('missing_jev_key');const get=store.get.bind(store);store.get=async key=>key==='jev.key'?secret:get(key);
 const {TypeSafeClient}=require('@typesafe-ai/sdk'),call=TypeSafeClient.prototype.systemOne;
 TypeSafeClient.prototype.systemOne=async function(...args){if(report.cloudCalls.length>=requestBudget)throw Error('request_budget');const row={at:Date.now(),state:structuredClone(args[0].state)};report.cloudCalls.push(row);try{const r=await call.apply(this,args);Object.assign(row,{ok:true,ms:Date.now()-row.at,model:r.model,action:r.answers.action.choice,destination:r.answers.destination?.choice});return r;}catch(e){Object.assign(row,{ok:false,ms:Date.now()-row.at,error:e.name});throw e;}};
 }
 control=new EtcAutoplay(new EtcBridge(dir),store);
 report.graphics='1280x720, 60fps cap, low shadows/effects/reflections/GI/textures, unchanged view distance';
 // Shipping ignores some console commands. Use real, isolated user settings;
 // never rewrite the user's Steam installation preferences or account profile.
 const gameData=path.join(data,'game'),config=path.join(gameData,'Saved/Config/Windows');await fs.mkdir(config,{recursive:true});
 const graphics='[ScalabilityGroups]\nsg.ResolutionQuality=100\nsg.ViewDistanceQuality=3\nsg.AntiAliasingQuality=1\nsg.ShadowQuality=1\nsg.GlobalIlluminationQuality=0\nsg.ReflectionQuality=0\nsg.PostProcessQuality=1\nsg.TextureQuality=1\nsg.EffectsQuality=1\nsg.FoliageQuality=3\nsg.ShadingQuality=1\nsg.LandscapeQuality=3\n\n[/Script/LyraGame.LyraSettingsLocal]\nVersion=5\nbUseVSync=False\nResolutionSizeX=1280\nResolutionSizeY=720\nLastUserConfirmedResolutionSizeX=1280\nLastUserConfirmedResolutionSizeY=720\nFullscreenMode=2\nLastConfirmedFullscreenMode=2\nFrameRateLimit=60.000000\n';
 await fs.writeFile(path.join(config,'GameUserSettings.ini'),graphics);report.graphicsHash=createHash('sha256').update(graphics).digest('hex');
 child=spawn(exe,['/EtcCore/Maps/L_ETC_MainMenu','-dx12','-windowed','-ResX=1280','-ResY=720',`-UserDir=${gameData.replaceAll('\\','/')}/`,`-JevBridgeDir=${dir}`],{cwd:path.join(release,'content'),env:{...process.env,SteamAppId:'5272970',SteamGameId:'5272970'},windowsHide:false,stdio:'ignore'});await new Promise((res,rej)=>{child.once('spawn',res);child.once('error',rej)});
 report.pid=child.pid;report.exe=exe;report.sha256=digest;report.bridge=dir;console.log(JSON.stringify({pid:child.pid,out,bridge:dir}));
 await fs.writeFile(path.join(out,'session-info.json'),JSON.stringify({pid:child.pid,bridge:dir,candidate:report.candidate,sha256:digest}));
 const deadline=Date.now()+90000;let o,focusAt=0,focusAttempts=0;
 while(Date.now()<deadline&&child.exitCode===null){o=await control.observe(child.pid);
  if(o?.executor&&!o.foreground&&focusAttempts<3&&Date.now()-focusAt>2500){focusAt=Date.now();focusAttempts++;try{execFileSync('powershell.exe',['-NoProfile','-File',path.join(__dirname,'focus-etc-candidate.ps1'),'-SmokeProcessId',String(child.pid),'-ExpectedExe',exe],{windowsHide:true,stdio:'ignore'});}catch{}}
  if(o?.foreground&&o.executor)break;
  await sleep(100)}
 if(!o?.foreground||!o.executor)throw Error('no_focused_shared_executor');
 let epoch=1;await control.change('auto',epoch);const started=Date.now();let sampleAt=0,stalls=0,lastFresh=Date.now(),savedSamples=0;
 while(Date.now()-started<seconds*1000&&child.exitCode===null){
  const readAt=Date.now();o=await control.observe(child.pid,!focusGate.paused);
  report.polls.push({at:readAt,readMs:Date.now()-readAt,ageMs:o?Date.now()-o.timestamp:null,frame:o?.frame,mode:o?.mode,reason:o?.executor?.reason});if(report.polls.length>200)report.polls.shift();
  if(o){
   if(live){const wasPaused=focusGate.paused,focus=focusGate.update(o,epoch,Date.now());
    if(focus==='stop'){report.stopReason='live_manual_takeover';break;}
    if(focus==='pause'||focus==='wait'){lastFresh=Date.now();if(!wasPaused&&focusGate.paused){report.events.push({at:Date.now(),kind:'focus_pause',frame:o.frame});await fs.writeFile(path.join(out,'playback.json'),JSON.stringify({state:'paused',pid:child.pid,at:Date.now()}));}await sleep(40);continue;}
    if(focus==='resume'){await control.resumeControl(++epoch);report.events.push({at:Date.now(),kind:'focus_resume',frame:o.frame});await fs.writeFile(path.join(out,'playback.json'),JSON.stringify({state:'playing',pid:child.pid,at:Date.now()}));await sleep(40);continue;}}
   if(!o.foreground){report.stopReason='focus_lost';report.focusLoss={at:Date.now(),phase:o.phase,mode:o.mode,frame:o.frame,observationAgeMs:Date.now()-o.timestamp,executor:o.executor};break;}
   if(control.transitionUntil>0){if(o.phase!=='playing'&&!o.roomPick){await sleep(40);continue;}if(o.phase==='playing'||o.mode==='manual')await control.resumeControl(++epoch);if(o.phase==='playing')control.transitionUntil=0;}
   if(o.mode==='manual'&&o.epoch===epoch){const recovery=control.recovery.poll(o,epoch,Date.now());if(recovery==='wait'){await sleep(40);continue;}if(recovery!=='resume'){report.stopReason='native_stop';report.events.push({at:Date.now(),native:o.executor,recovery,phase:o.phase,foreground:o.foreground,ageMs:Date.now()-o.timestamp,held:o.diagnostics.heldInputs,recoveryState:{...control.recovery}});break;}report.events.push({at:Date.now(),native:o.executor,recovery});await control.resumeControl(++epoch);}
   await control.tick(settings,epoch);lastFresh=Date.now();
   if(o.frame!==report.lastMotionFrame){report.lastMotionFrame=o.frame;await fs.appendFile(path.join(out,'motion.ndjson'),JSON.stringify({at:Date.now(),timestamp:o.timestamp,frame:o.frame,matchId:o.matchId,phase:o.phase,mode:o.mode,room:o.self.room,traveling:o.self.traveling,view:o.diagnostics.view,motion:o.diagnostics.motion,roomPick:o.roomPick,action:o.diagnostics.lastAction})+'\n');}
   if(Date.now()-sampleAt>500){sampleAt=Date.now();report.samples.push({at:sampleAt,phase:o.phase,position:o.self.position,room:o.self.room,hp:o.self.health,magazine:o.self.magazine,shots:o.diagnostics.shots,action:o.diagnostics.lastAction,executor:o.executor,held:o.diagnostics.heldInputs,self:o.self,enemies:o.enemies,actions:o.actions,zone:o.zone,mapView:o.mapView,navigation:control.navigation.context(),knowledge:control.navigation.knowledge.context(o)});if(report.samples.length%20===0)console.log(JSON.stringify({at:sampleAt,phase:o.phase,room:o.self.room,hp:o.self.health,mag:o.self.magazine,shots:o.diagnostics.shots,enemies:o.enemies.length,offers:o.actions.reduce((a,x)=>(a[x.kind]=(a[x.kind]??0)+1,a),{}),action:o.diagnostics.lastAction,executor:o.executor}));}
   if(control.summary.matches>report.officialResults.length){report.officialResult={...o.result,matchId:o.matchId,frame:o.frame,phase:o.phase};report.officialResults.push({...report.officialResult,at:Date.now(),kills:control.summary.kills,damageDealt:control.summary.damageDealt,shots:control.summary.shots});await fs.writeFile(path.join(out,'results.json'),JSON.stringify(report.officialResults,null,2));console.log(JSON.stringify({officialResult:report.officialResults.at(-1),matches:control.summary.matches}));
    if(control.summary.matches>=requestedMatches){report.stopReason=requestedMatches===1?'official_result':'demo_complete';break;}}
   if(report.samples.length>=savedSamples+20){savedSamples=report.samples.length;await fs.writeFile(path.join(out,'live.json'),JSON.stringify({pid:child.pid,candidate:report.candidate,summary:control.summary,cloudStats:control.stats,samples:report.samples.slice(-20),cloudCalls:report.cloudCalls.slice(-4)},null,2));}
   if(report.cloudCalls.length>=requestBudget){report.stopReason='request_budget';break;}
  }else if(Date.now()-lastFresh>15000){report.stopReason='no_fresh_state';break;}
  await sleep(40);
 }
 report.summary=control.summary;report.cloudStats=control.stats;report.stopReason??='time_budget';
 if(report.stopReason!=='official_result')process.exitCode=2;
}).catch(e=>{report.error=/^[a-z_]+$/.test(e.message)?e.message:'test_failed';process.exitCode=1}).finally(async()=>{
 if(control){const requestedAt=Date.now();await control.change('manual',999).catch(()=>{});const {verifyManualRelease}=require('./verify-manual-release.cjs');report.releaseCheck=await verifyManualRelease({observe:pid=>control.observe(pid),pid:child?.pid,epoch:999,requestedAt});report.manualRelease=report.releaseCheck.confirmed;await control.close(1000).catch(()=>{});}
 if(report.focusLoss&&child?.pid){try{report.focusLoss.os=JSON.parse(execFileSync('powershell.exe',['-NoProfile','-File',path.join(__dirname,'inspect-candidate-focus.ps1'),'-CandidateProcessId',String(child.pid)],{windowsHide:true,encoding:'utf8',timeout:5000,stdio:['ignore','pipe','ignore']}));}catch{report.focusLoss.os={error:'unavailable'};}}
 secret=undefined;report.finishedAt=new Date().toISOString();report.gameRetained=!!(live&&report.manualRelease&&child?.exitCode===null);if(out){await fs.writeFile(path.join(out,'receipt.json'),JSON.stringify(report,null,2));await fs.writeFile(path.join(out,'playback.json'),JSON.stringify({state:'ended',pid:child?.pid,reason:report.stopReason,gameRetained:report.gameRetained,at:Date.now()}));}if(child?.exitCode===null&&!report.gameRetained)child.kill();else child?.unref();console.log(JSON.stringify({out,summary:report.summary,cloudStats:report.cloudStats,stopReason:report.stopReason,error:report.error,manualRelease:report.manualRelease,gameRetained:report.gameRetained}));app.exit(process.exitCode??0);
});
