// Actual OBS encoders -> three loopback RTMP receivers. Never uses platform tokens.
const { _electron: electron }=require('playwright');
const {spawn,execFileSync}=require('node:child_process');
const fs=require('node:fs/promises');
const path=require('node:path');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const root=path.resolve(__dirname,'..'),out=path.join(root,'test-results');await fs.mkdir(out,{recursive:true});
  const env={...process.env,JEV_TEST_DATA_DIR:path.join(process.env.LOCALAPPDATA,'JEV Studio StreamTest')};delete env.ELECTRON_RUN_AS_NODE;delete env.JEV_DEV_URL;
  const receivers=[];let app;
  try {
    for(const [index,provider] of ['youtube','twitch','x'].entries()) {
      const file=path.join(out,`loopback-${provider}.flv`);
      const child=spawn('ffmpeg',['-hide_banner','-loglevel','error','-y','-listen','1','-i',`rtmp://127.0.0.1:${19351+index}/live/fixture`,'-c','copy',file],{windowsHide:true,stdio:['pipe','ignore','pipe']});
      child.on('error',e=>console.error(`Receiver ${provider}: ${e.message}`));
      child.stderr.on('data',()=>{});receivers.push({provider,child,file});
    }
    await pause(1000);app=await electron.launch({args:[root],env,timeout:60000});const page=await app.firstWindow();await page.waitForSelector('.studio-grid');
    const result=await app.evaluate(async({safeStorage},{root,directory})=>{
      const require=process.getBuiltinModule('module').createRequire(root+'/package.json');
      const {Store}=require(require('node:path').join(root,'dist-main','electron','storage.js'));
      const {Obs,obsPorts}=require(require('node:path').join(root,'dist-main','electron','obs.js'));
      // Test servers must not attach to production OBS profiles.
      Object.assign(obsPorts,{youtube:44651,twitch:44652,x:44653});
      const names=['youtube','twitch','x'];
      const store=new Store(directory,safeStorage);await store.init();await store.saveSettings({...await store.settings(),enabledPlatforms:names});const obs=new Obs(store,()=>{});await obs.setup();
      if(names.some(p=>obs.states[p].active))throw new Error('Refusing to alter an active stream');
      try {
        for(const [i,p] of names.entries()) {
          const c=obs.clients[p];const kinds=await c.call('GetInputKindList');const kind=kinds.inputKinds.find(k=>k.startsWith('color_source'));
          await c.call('CreateInput',{sceneName:'JEV Program',inputName:'Local RTMP Acceptance',inputKind:kind,inputSettings:{width:1920,height:1080,color:[0xff5555ee,0xffcc9944,0xff559955][i]},sceneItemEnabled:true});
          await obs.service(p,`rtmp://127.0.0.1:${19351+i}/live`,'fixture');
        }
        for(const p of names)await obs.start(p);await new Promise(r=>setTimeout(r,12000));await obs.poll();
        return JSON.parse(JSON.stringify(obs.states));
      } finally {
        for(const p of names) {
          await obs.stop(p).catch(()=>{});await obs.clearKey(p).catch(()=>{});
          await obs.clients[p].call('RemoveInput',{inputName:'Local RTMP Acceptance'}).catch(()=>{});
          await obs.clients[p].disconnect();
        }
      }
    },{root,directory:env.JEV_TEST_DATA_DIR});
    await pause(1000);
    const report={outputs:result,receivers:[]};
    for(const receiver of receivers) {
      const streams=JSON.parse(execFileSync('ffprobe',['-v','error','-show_entries','stream=codec_type,codec_name,width,height,r_frame_rate,profile,bit_rate','-of','json',receiver.file],{encoding:'utf8',windowsHide:true})).streams;
      const bytes=(await fs.stat(receiver.file)).size;
      const pixel=execFileSync('ffmpeg',['-v','error','-i',receiver.file,'-frames:v','1','-vf','scale=1:1','-f','rawvideo','-pix_fmt','rgb24','pipe:1'],{windowsHide:true});
      report.receivers.push({provider:receiver.provider,streams,bytes,pixel:[...pixel]});
      if(!streams.some(s=>s.codec_type==='video'&&s.codec_name==='h264'&&s.width===1920&&s.height===1080&&s.r_frame_rate===(receiver.provider==='x'?'30/1':'60/1'))||!streams.some(s=>s.codec_name==='aac')||bytes<50000)throw new Error(`Insufficient local output: ${receiver.provider}`);
      if(receiver.provider==='x'){
        const frames=JSON.parse(execFileSync('ffprobe',['-v','error','-select_streams','v:0','-skip_frame','nokey','-show_entries','frame=best_effort_timestamp_time','-of','json',receiver.file],{encoding:'utf8',windowsHide:true})).frames;
        const times=frames.map(f=>Number(f.best_effort_timestamp_time));const intervals=times.slice(1).map((v,i)=>v-times[i]);
        if(intervals.length<2||intervals.some(v=>Math.abs(v-3)>.1))throw new Error('X keyframe interval is not three seconds');
        report.xKeyframeIntervals=intervals;
      }
    }
    if(new Set(report.receivers.map(r=>JSON.stringify(r.pixel))).size!==3)throw new Error('Outputs unexpectedly share a canvas');
    await fs.writeFile(path.join(out,'local-stream-acceptance.json'),JSON.stringify(report,null,2));
    console.log(JSON.stringify(report));
  } finally {
    for(const r of receivers){if(r.child.exitCode===null)r.child.kill();}
    if(app){await app.evaluate(({app})=>app.quit());await app.close().catch(()=>{});}
    // Playwright's job closes child OBS before its deferred scene save may finish.
    // Remove only our named fixture from the dedicated test profiles, including backups.
    for(const provider of ['youtube','twitch','x'])for(const file of ['JEV.json','JEV.json.bak']){
      const target=path.join(env.JEV_TEST_DATA_DIR,'obs',provider,'config','obs-studio','basic','scenes',file);
      try{const data=JSON.parse(await fs.readFile(target,'utf8'));data.sources=data.sources.filter(s=>s.name!=='Local RTMP Acceptance');for(const source of data.sources)if(source.settings?.items)source.settings.items=source.settings.items.filter(i=>i.name!=='Local RTMP Acceptance');await fs.writeFile(target,JSON.stringify(data));}catch(e){if(e.code!=='ENOENT')throw e;}
    }
  }
})().catch(e=>{console.error(e.message);process.exitCode=1;});
