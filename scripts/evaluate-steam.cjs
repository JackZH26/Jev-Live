// Observe the installed Steam game through the running Studio. Never launches an editor or writes native commands.
const fs=require('node:fs/promises'),path=require('node:path'),{chromium}=require('playwright');
const arg=name=>{const i=process.argv.indexOf('--'+name);return i<0?undefined:process.argv[i+1]};
const label=arg('label')||'candidate',count=Number(arg('matches')||3),minutes=Number(arg('minutes')||30);
if(!/^[a-z0-9-]+$/i.test(label)||!Number.isInteger(count)||count<1||count>100||!Number.isFinite(minutes)||minutes<1||minutes>720)throw Error('Invalid evaluation options');
const root=path.resolve(__dirname,'..'),out=path.join(root,'test-results','steam-evaluation',label+'-'+Date.now());
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 await fs.mkdir(out,{recursive:true});const browser=await chromium.connectOverCDP('http://127.0.0.1:63810');
 const page=browser.contexts()[0].pages().find(p=>p.url().includes('/release/current/win-unpacked/'));if(!page)throw Error('Canonical Studio missing');
 const summary={label,at:new Date().toISOString(),out,results:[],interrupted:[],lobbyDelays:[],complete:false};let owned=false,current,previous,stopReason='budget',lastWrite=0,lastStatus=0,lobbyAt=0;
 try{
  const s=await page.evaluate(()=>window.studio.snapshot());
  if(s.selectedGame?.appId!=='5272970'||!s.selectedGame.installDirectory.includes('steamapps')||!s.gameConnected||s.mode!=='manual')throw Error('Start in the connected Steam lobby with manual control');
  if(arg('build')&&s.selectedGame.buildId!==arg('build'))throw Error('Unexpected installed Steam build');
  if(s.game?.phase!=='menu'&&!['dead','ended'].includes(s.game?.phase))throw Error('Baseline requires a lobby or official result');
  Object.assign(summary,{build:s.build,steamBuild:s.selectedGame.buildId,steamBranch:s.selectedGame.branch,pid:s.gamePid,session:s.game.session,provider:s.settings.decisionProvider});
  const matchFile=path.join(process.env.LOCALAPPDATA,'JevLive/etc-bridge/state.json');
  const finish=async()=>fs.writeFile(path.join(out,'summary.json'),JSON.stringify(summary,null,2));await finish();
  await page.evaluate(()=>window.studio.setMode('auto'));owned=true;const started=Date.now();
  while(Date.now()-started<minutes*60000){
   let o;try{o=JSON.parse(await fs.readFile(matchFile,'utf8'));}catch{await sleep(100);continue;}
   const now=Date.now();if(o.processId!==summary.pid||o.session!==summary.session)throw Error('Steam control identity changed');
   if(now-o.timestamp>1000){if(now-o.timestamp>15000)throw Error('Steam telemetry stopped');await sleep(100);continue;}
   if(o.phase==='menu'&&!lobbyAt)lobbyAt=now;
   if(lobbyAt&&o.phase==='loading'){summary.lobbyDelays.push({at:new Date(now).toISOString(),seconds:(now-lobbyAt)/1000,afterResult:!!current?.finished});lobbyAt=0;}
   if(o.phase==='playing'&&current?.id!==o.matchId){
    if(current&&!current.finished)summary.interrupted.push({...current,reason:'match changed without result'});
    current={id:o.matchId,startedAt:now,eligible:true,rooms:[],mechanicalSightings:0,mechanicalEngageFrames:0,hurtEvents:0,stalledMs:0,phase:o.phase,kills:0,damage:0};
   }
   const machines=o.enemies.filter(e=>/EtcMechanicalPawn/i.test(e.id));
   if(current?.id===o.matchId&&!current.finished){
    if(!o.foreground)current.eligible=false;
    if(!current.rooms.includes(o.self.room)&&o.self.room>=0)current.rooms.push(o.self.room);
    if(machines.length)current.mechanicalSightings++;
    if(/engage_.*EtcMechanicalPawn/i.test(o.diagnostics.lastAction))current.mechanicalEngageFrames++;
    if(previous?.matchId===o.matchId&&o.self.health<previous.self.health-.5)current.hurtEvents++;
    if(previous?.matchId===o.matchId&&o.self.room===previous.self.room&&o.phase==='playing'&&!o.self.healing&&!o.self.reloading&&Math.hypot(...o.self.position.map((v,i)=>v-previous.self.position[i]))<3)current.stalledMs+=Math.min(1000,now-previous.sampledAt);
    current.kills=o.self.kills;current.damage=o.self.damageDealt??0;current.phase=o.phase;
    if(o.result){current.finished=true;const result={...current,endedAt:now,durationSeconds:(now-current.startedAt)/1000,placement:o.result.placement,won:o.result.won,finalRoom:o.self.room,finalRoomType:o.self.roomType,finalHealth:o.self.health,finalDanger:o.self.danger,finalZone:o.zone,finalAction:o.diagnostics.lastAction};
     if(current.eligible)summary.results.push(result);else summary.interrupted.push({...result,reason:'focus lost'});
     console.log(JSON.stringify({result}));await finish();
     if(summary.results.length>=count){summary.complete=true;stopReason='requested matches completed';break;}
    }
   }
   if(now-lastWrite>=200){lastWrite=now;await fs.appendFile(path.join(out,'observations.jsonl'),JSON.stringify({sampledAt:now,...o})+'\n');}
   if(now-lastStatus>=30000){lastStatus=now;const app=await page.evaluate(()=>window.studio.snapshot());if(app.mode!=='auto')throw Error('Studio automatic control stopped: '+app.gameError);console.log(JSON.stringify({phase:o.phase,match:o.matchId,health:o.self.health,kills:o.self.kills,room:o.self.room,action:o.diagnostics.lastAction,machines:machines.length,completed:summary.results.length}));}
   previous={...o,sampledAt:now};await sleep(100);
  }
 }catch(e){stopReason=e.message;summary.error=e.message;process.exitCode=1;}
 finally{
  if(owned){try{await page.evaluate(()=>window.studio.setMode('manual'));await sleep(350);const s=await page.evaluate(()=>window.studio.snapshot());summary.released=s.mode==='manual'&&s.game?.mode==='manual'&&s.gameInput.heldInputs===0;}catch(e){summary.releaseError=e.message;}if(!summary.released)process.exitCode=1;}
  if(!summary.complete)process.exitCode=1;
  if(current&&!current.finished)summary.interrupted.push({...current,reason:stopReason});
  Object.assign(summary,{endedAt:new Date().toISOString(),stopReason});await fs.writeFile(path.join(out,'summary.json'),JSON.stringify(summary,null,2));await browser.close();console.log(JSON.stringify({summary}));
 }
})().catch(e=>{console.error(e.message);process.exitCode=1});
