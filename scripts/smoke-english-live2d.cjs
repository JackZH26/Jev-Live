// Local desktop + overlay acceptance. Isolated profile; no credentials or platform posts.
const {_electron:electron,chromium}=require('playwright'),fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const root=path.resolve(__dirname,'..'),data=await fs.mkdtemp(path.join(process.env.LOCALAPPDATA,'JEV-EnglishGirl-'));
 const out=process.env.JEV_ACCEPTANCE_DIR||path.join(root,'test-results','english-live2d');await fs.mkdir(out,{recursive:true});
 await fs.writeFile(path.join(data,'host.json'),JSON.stringify({language:'ko',speechProvider:'qwen-clone',commentary:false,chatPlatforms:[]}));
 const env={...process.env,JEV_TEST_DATA_DIR:data};delete env.ELECTRON_RUN_AS_NODE;delete env.JEV_DEV_URL;
 let app,browser;const errors=[],consoleErrors=[];
 try{
  app=await electron.launch({...(process.env.JEV_TEST_EXE?{executablePath:process.env.JEV_TEST_EXE,args:[]}:{args:[root]}),env,timeout:60000});
  const page=await app.firstWindow();page.on('pageerror',e=>errors.push(e.stack));page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
  await page.waitForSelector('.studio-grid');await page.locator('.nav-item').nth(1).click();await page.waitForSelector('.layout-stage');
  await page.waitForSelector('[data-avatar-kind=live2d][data-avatar-state=ready]',{timeout:45000});
  const config=await page.evaluate(()=>window.studio.hostSnapshot().then(s=>s.config));assert.equal(config.language,'en');assert.equal(config.speechProvider,'melo');
  const bytes=Array.from(await fs.readFile(path.join(root,'public/live2d/jev-girl/jev-girl.moc3')));
  const rig=await page.evaluate(bytes=>{
   const C=window.Live2DCubismCore,moc=C.Moc.fromArrayBuffer(new Uint8Array(bytes).buffer),model=C.Model.fromMoc(moc);
   const reset=()=>{model.parameters.values.set(model.parameters.defaultValues);model.update();};
   const set=(id,value)=>{const i=model.parameters.ids.indexOf(id);if(i<0)throw new Error('Missing '+id);model.parameters.values[i]=value;model.update();};
   const opacity=id=>model.drawables.opacities[model.drawables.ids.indexOf(id)];
   const results={coreVersion:C.Version.csmGetVersion(),meshes:model.drawables.ids.length};
   for(const [param,open,closed] of [['ParamEyeLOpen','EyeLeft','ClosedEyeLeft'],['ParamEyeROpen','EyeRight','ClosedEyeRight'],['ParamMouthOpenY','MouthOpen','MouthClosed']]){
    reset();set(param,0);const zero=[opacity(open),opacity(closed)];set(param,1);results[param]={zero,one:[opacity(open),opacity(closed)]};
   }
   for(const [id,a,b] of [['ParamAngleZ',-30,30],['ParamBreath',0,1]]){
    reset();set(id,a);const before=model.drawables.vertexPositions.map(v=>Array.from(v));set(id,b);
    results[id]=model.drawables.vertexPositions.some((v,i)=>v.some((n,j)=>Math.abs(n-before[i][j])>.00001));
   }
   model.release();moc._release();return results;
  },bytes);
  assert.equal(rig.meshes,15);for(const param of ['ParamEyeLOpen','ParamEyeROpen','ParamMouthOpenY']){assert.deepEqual(rig[param].zero,[0,1]);assert.deepEqual(rig[param].one,[1,0]);}
  assert(rig.ParamAngleZ,'Tilt must change exported vertices');assert(rig.ParamBreath,'Breathing must change exported vertices');
  for(const language of ['zh-CN','zh-TW','ja','ko','en']){
   await page.selectOption('#language',language);await page.waitForFunction(l=>document.documentElement.lang===l,language);
   await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1080,820));
   assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),'Overflow '+language);
   assert(!/host\.[a-zA-Z]/.test(await page.locator('.host-panel').innerText()));
   assert.equal(await page.locator('option[value="qwen-clone"]').count(),0);
  }
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1480,960));await page.selectOption('#language','zh-CN');
  await page.screenshot({path:path.join(out,'desktop.png'),fullPage:true});
  await page.evaluate(()=>{
   window.previewAudioEvidence={ended:false,peak:0};
   const play=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){this.addEventListener('ended',()=>{window.previewAudioEvidence.ended=true;},{once:true});return play.call(this);};
   const sample=AnalyserNode.prototype.getByteTimeDomainData;AnalyserNode.prototype.getByteTimeDomainData=function(values){sample.call(this,values);const rms=Math.sqrt(values.reduce((sum,v)=>sum+(v-128)**2,0)/values.length)/128;window.previewAudioEvidence.peak=Math.max(window.previewAudioEvidence.peak,rms);};
  });
  await page.getByRole('button',{name:'测试语音与口型',exact:true}).click();
  const previewDeadline=Date.now()+30000;while(Date.now()<previewDeadline){if((await page.evaluate(()=>window.previewAudioEvidence)).ended)break;await new Promise(r=>setTimeout(r,150));}
  const previewVoice=await page.evaluate(()=>window.previewAudioEvidence);assert(previewVoice.ended);assert(previewVoice.peak>.01,'Preview lip sync needs a non-silent audio envelope');
  await page.locator('[data-layer=avatar]').screenshot({path:path.join(out,'avatar.png')});
  const audio=await page.evaluate(async()=>{const url=await window.studio.testHostVoice('ja');return{url,snapshot:await window.studio.hostSnapshot()};});
  assert.equal(audio.snapshot.utterance.language,'en');assert.equal(audio.snapshot.stats.failures,0);
  // A production overlay page supplies the actual audio envelope to the model.
  const overlayURL=audio.url.replace(/\/audio\/[^/]+$/,'/view/twitch');
  browser=await chromium.launch({headless:true,args:['--autoplay-policy=no-user-gesture-required']});
  const overlay=await browser.newPage({viewport:{width:1920,height:1080}});overlay.on('pageerror',e=>errors.push(e.stack));overlay.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
  await overlay.goto(overlayURL);await overlay.waitForSelector('[data-avatar-kind=live2d][data-avatar-state=ready]',{timeout:45000});
  // Real 300 ms state polling must preserve the canvas and model between updates.
  let statePolls=0;const trackState=response=>{if(response.url().includes('/state/twitch'))statePolls++;};overlay.on('response',trackState);
  await overlay.evaluate(()=>{const root=document.querySelector('.avatar-stage');window.avatarStability={canvas:root.querySelector('canvas'),replacements:0};const probe=window.avatarStability;probe.observer=new MutationObserver(records=>{for(const r of records)for(const n of r.removedNodes)if(n.nodeName==='CANVAS')probe.replacements++;});probe.observer.observe(root,{childList:true});});
  await overlay.waitForTimeout(5000);
  const avatarStability=await overlay.evaluate(()=>{const probe=window.avatarStability;probe.observer.disconnect();return{sameCanvas:probe.canvas===document.querySelector('.avatar-stage canvas'),replacements:probe.replacements};});overlay.off('response',trackState);
  assert(statePolls>=10,'Stability check must include repeated real state updates');assert(avatarStability.sameCanvas,'State polling must retain the Live2D canvas');assert.equal(avatarStability.replacements,0,'State polling must not destroy the rig');
  // Generate after loading so the clip cannot expire during renderer startup.
  await page.evaluate(()=>window.studio.testHostVoice());
  const deadline=Date.now()+30000;while(Date.now()<deadline){if((await page.evaluate(()=>window.studio.hostSnapshot())).overlay.twitch.audioEnded>=1)break;await new Promise(r=>setTimeout(r,150));}
  await overlay.screenshot({path:path.join(out,'overlay.png')});
  const health=await page.evaluate(()=>window.studio.hostSnapshot().then(s=>s.overlay.twitch));
  assert(health.audioEnded>=1,'Actual audio must finish playing');assert.equal(health.audioErrors,0);assert.equal(health.stateErrors,0);assert.deepEqual(errors,[]);
  assert(!consoleErrors.some(e=>/Content Security Policy|EvalError|Live2D/i.test(e)),consoleErrors.join('\n'));
  const report={passed:true,uiLocales:5,spokenLanguage:'en',speechProvider:'melo',previewVoice,rig,avatarStability:{...avatarStability,statePolls},health,errors,consoleErrors,externalPosts:0,profile:data,executable:process.env.JEV_TEST_EXE||'development Electron'};
  await fs.writeFile(path.join(out,'acceptance.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }catch(e){console.error({errors,consoleErrors});throw e;}finally{await browser?.close();if(app){await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{});}}
})().catch(e=>{console.error(e);process.exitCode=1;});
