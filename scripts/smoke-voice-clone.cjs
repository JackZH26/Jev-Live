// Isolated desktop acceptance. The default uses a fake speech server; --real uses Qwen.
const {_electron:electron}=require('playwright'),fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const arg=name=>process.argv.find(v=>v.startsWith('--'+name+'='))?.split('=').slice(1).join('=');
(async()=>{
 const root=path.resolve(__dirname,'..'),real=process.argv.includes('--real'),reference=arg('reference'),transcript=arg('transcript');
 if(!reference||!transcript)throw new Error('Pass --reference=english.wav --transcript=english.txt');
 const clip=await fs.readFile(reference),text=(await fs.readFile(transcript,'utf8')).trim(),data=await fs.mkdtemp(path.join(process.env.LOCALAPPDATA,'JevVoiceClone-'));
 const env={...process.env,JEV_TEST_DATA_DIR:data};delete env.ELECTRON_RUN_AS_NODE;delete env.JEV_DEV_URL;
 const requests=[],rows=[],errors=[];let app,server;
 try{
  if(!real){server=http.createServer((request,response)=>{if(request.url==='/health'){response.setHeader('Content-Type','application/json');response.end(JSON.stringify({ready:true,provider:'qwen3-tts-clone'}));return;}let body='';request.on('data',b=>body+=b);request.on('end',()=>{const value=JSON.parse(body);assert.equal(value.reference.audio,clip.toString('base64'));assert.equal(value.reference.text,text);assert.equal(value.voice,'');requests.push(value.language);response.setHeader('Content-Type','audio/wav');response.end(clip);});});await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(11438,'127.0.0.1',resolve);});}
  app=await electron.launch({...(arg('executable')?{executablePath:arg('executable'),args:[]}:{args:[root]}),env,timeout:60000});
  const page=await app.firstWindow();page.on('pageerror',e=>errors.push(e.message));await page.waitForSelector('.studio-grid');await page.locator('.nav-item').nth(1).click();
  await page.locator('[data-testid=speech-provider]').selectOption('qwen-clone');
  await app.evaluate(({dialog},audioPath)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[audioPath]});},path.resolve(reference));
  await page.locator('[data-testid=voice-clone] button').click();
  for(let i=0;i<100;i++){if((await page.evaluate(()=>window.studio.hostSnapshot())).config.voiceClone.asset)break;await page.waitForTimeout(50);}
  await page.waitForFunction(()=>document.querySelector('[data-testid=voice-transcript]').matches(':enabled'));
  await page.locator('[data-testid=voice-transcript]').fill(text);
  for(const locale of ['zh-CN','zh-TW','ja','ko','en']){
   await page.selectOption('#language',locale);await page.waitForFunction(l=>document.documentElement.lang===l,locale);
   assert(!/host\.[a-zA-Z]/.test(await page.locator('[data-testid=voice-clone]').innerText()));
   await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1080,820));
   assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),'Layout overflow: '+locale);
  }
  for(const language of ['en','zh-CN','zh-TW','ja','ko']){
   const spokenBefore=(await page.evaluate(()=>window.studio.hostSnapshot())).stats.spoken,start=Date.now();
   await page.locator(`[data-voice-language="${language}"]`).click();
   let after;const deadline=Date.now()+45000;
   do{after=await page.evaluate(()=>window.studio.hostSnapshot());if(after.error||after.stats.spoken>spokenBefore&&after.utterance?.language===language)break;await page.waitForTimeout(100);}while(Date.now()<deadline);
   assert.equal(after.error,'');assert(after.utterance?.audio);assert.equal(after.utterance.language,language);assert.equal(after.config.language,'en');
   await page.waitForFunction(()=>document.querySelector('[data-testid=voice-transcript]').matches(':enabled'));
   rows.push({language,elapsedMs:Date.now()-start,audio:true,spoken:after.stats.spoken});
  }
  if(!real)assert.deepEqual(requests,['en','zh-CN','zh-TW','ja','ko']);
  assert.deepEqual(errors,[]);assert.deepEqual(await page.locator('.host-panel .notice').allTextContents(),[]);assert.equal((await page.evaluate(()=>window.studio.snapshot())).mode,'manual');
  const saved=JSON.parse(await fs.readFile(path.join(data,'host.json'),'utf8'));assert.equal(saved.voiceClone.text,text);assert.equal(saved.speechProvider,'qwen-clone');
  await fs.mkdir(path.join(root,'test-results','voice-clone'),{recursive:true});await page.screenshot({path:path.join(root,'test-results','voice-clone',real?'real-ui.png':'mock-ui.png'),fullPage:true});
  const receipt={at:new Date().toISOString(),realInference:real,reference:'English test fixture; not Astesi',fiveLanguageUI:true,privateReferenceImported:true,hostLanguageUnchanged:true,errors,rows};
  await fs.writeFile(path.join(root,'test-results','voice-clone',real?'real-ui.json':'mock-ui.json'),JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));
 }finally{if(app){await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{});}if(server)await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
