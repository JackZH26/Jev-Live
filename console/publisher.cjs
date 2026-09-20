const fs=require('node:fs/promises'),path=require('node:path'),{app,safeStorage}=require('electron'),OBS=require('obs-websocket-js').default;
const {project}=require('./telemetry.cjs'),{evaluate}=require('../scripts/hybrid-streak.cjs');const root=path.resolve(__dirname,'..');
app.disableHardwareAcceleration();let stopped=false;for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{stopped=true});
const read=async p=>JSON.parse(await fs.readFile(p,'utf8')),sleep=ms=>new Promise(r=>setTimeout(r,ms));
app.whenReady().then(async()=>{
 const {Store}=require('../dist-main/electron/storage'),store=new Store(path.join(process.env.LOCALAPPDATA,'JevPrivateConsole'),safeStorage),config=await store.get('server');
 if(!config)throw Error('not_provisioned');let obs,frame,frameAt=0,trial='',route=[],timeline=[],latencies=[],seen=new Set(),lastObjective='',ledger={streak:0},ledgerAt=0,boundPid=0;
 async function connectObs(){if(!obs){const c=await read(path.join(process.env.APPDATA,'JEV Studio/obs/x/config/obs-studio/plugin_config/obs-websocket/config.json'));obs=new OBS();await obs.connect('ws://127.0.0.1:44553',c.server_password);}}
 async function bindReview(meta,o){if(!process.argv.includes('--bind-x-preview')||boundPid===meta.pid||!o.foreground||Date.now()-o.timestamp>1000)return;
  await connectObs();if(!(await obs.call('GetStreamStatus')).outputActive)return;
  const {propertyItems}=await obs.call('GetInputPropertiesListPropertyItems',{inputName:'ETC Game',propertyName:'window'});
  const target=propertyItems.find(x=>x.itemEnabled&&x.itemValue==='JEV Hybrid Acceptance:UnrealWindow:LyraGame-Win64-Shipping.exe');if(!target)return;
  await obs.call('SetInputSettings',{inputName:'ETC Game',inputSettings:{window:target.itemValue,priority:0},overlay:true});
  // WASAPI can keep the previous process capture alive when its HWND is reused.
  // A distinct empty target invalidates that session before binding the new PID.
  await obs.call('SetInputSettings',{inputName:'ETC Audio',inputSettings:{window:''},overlay:true});
  await sleep(1000);
  await obs.call('SetInputSettings',{inputName:'ETC Audio',inputSettings:{window:target.itemValue,priority:0},overlay:true});
  boundPid=meta.pid;frame=undefined;frameAt=Date.now();console.log('Private X preview rebound to the current acceptance game.');
 }
 async function image(){if(Date.now()-frameAt<5000)return frame;frameAt=Date.now();try{
  await connectObs();
  const r=await obs.call('GetSourceScreenshot',{sourceName:'JEV Program',imageFormat:'jpg',imageWidth:768,imageCompressionQuality:55});frame=r.imageData.split(',')[1];return frame;
 }catch{await obs?.disconnect().catch(()=>{});obs=undefined;return undefined}}
 console.log('Console telemetry publisher started; credentials withheld.');
 while(!stopped){try{
  const dirs=(await fs.readdir(path.join(root,'test-results'))).filter(n=>/^hybrid-smoke-\d+$/.test(n)).sort().reverse();let meta,dir;
  for(const name of dirs){try{meta=await read(path.join(root,'test-results',name,'session-info.json'));dir=path.join(root,'test-results',name);meta.trial=name;break}catch{}}
  if(!meta){await sleep(2000);continue}
  const o=await read(path.join(meta.bridge,'state.json'));if(o.processId!==meta.pid)throw Error('identity');
  await bindReview(meta,o);
  const live=await read(path.join(dir,'live.json')).catch(()=>null),receipt=await read(path.join(dir,'receipt.json')).catch(()=>null);
  if(trial!==meta.trial){trial=meta.trial;route=[];timeline=[];latencies=[];seen.clear();lastObjective='';}
  if(o.phase==='playing'&&o.self.room>=0&&route.at(-1)?.room!==o.self.room){route.push({room:o.self.room,x:o.self.position[0],y:o.self.position[1]});if(route.length>100)route.shift();}
  for(const c of live?.cloudCalls||[]){if(seen.has(c.at))continue;seen.add(c.at);if(seen.size>1000)seen.delete(seen.values().next().value);if(c.ok)timeline.push({at:c.at,action:c.action,ms:c.ms,status:'jev'});if(Number.isFinite(c.ms))latencies.push(c.ms);}
  const objective=[o.executor?.objective,o.executor?.status,o.executor?.reason].join('|');
  if(objective!==lastObjective){lastObjective=objective;timeline.push({at:o.timestamp,action:o.executor?.objective,status:o.executor?.status});}
  timeline=timeline.slice(-60);latencies=latencies.slice(-40);
  if(Date.now()-ledgerAt>10000){const receipts=[];for(const name of dirs){try{receipts.push({file:name,r:await read(path.join(root,'test-results',name,'receipt.json'))})}catch{}}const result=evaluate(receipts);ledger={streak:result.streak,best:result.best,target:2};ledgerAt=Date.now();}
  const data=project(o,live,meta);Object.assign(data,{route,timeline:timeline.toSorted((a,b)=>a.at-b.at),streak:ledger,frame:await image()});data.cloud.latencies=latencies;
  if(receipt?.officialResult)data.result=receipt.officialResult;
  const response=await fetch(config.origin+'/jev-console/ingest',{method:'POST',headers:{Authorization:'Bearer '+config.ingest_token,'Content-Type':'application/json'},body:JSON.stringify(data),signal:AbortSignal.timeout(6000)});
  if(!response.ok)console.log('Console upload unavailable: HTTP '+response.status);
 }catch{console.log('Console waiting for fresh readable telemetry or network.');}await sleep(2000);}
 await obs?.disconnect().catch(()=>{});
}).catch(()=>{console.error('Console publisher failed; credentials withheld.');process.exitCode=1}).finally(()=>app.exit(process.exitCode||0));
