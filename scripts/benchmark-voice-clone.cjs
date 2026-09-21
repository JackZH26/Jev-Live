// Real local inference only. Output audio and timing stay outside version control.
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const {waveDuration,waveIsSilent}=require('../dist-main/electron/speech.js');
const arg=name=>process.argv.find(v=>v.startsWith('--'+name+'='))?.split('=').slice(1).join('=');
(async()=>{
 const referencePath=arg('reference'),textPath=arg('transcript'),out=path.resolve(arg('out')||'test-results/voice-clone'),endpoint='http://127.0.0.1:11438';
 if(!referencePath||!textPath)throw new Error('Pass --reference=english.wav --transcript=english.txt');
 const reference={audio:(await fs.readFile(referencePath)).toString('base64'),text:(await fs.readFile(textPath,'utf8')).trim()},rows=[];
 const deadline=Date.now()+240000;let health;
 do{health=await fetch(endpoint+'/health').then(r=>r.json()).catch(()=>null);if(health?.ready)break;if(health?.restarts)throw new Error('Model loading failed');await new Promise(r=>setTimeout(r,1000));}while(Date.now()<deadline);
 assert.equal(health?.provider,'qwen3-tts-clone');assert.equal(health?.ready,true);await fs.mkdir(out,{recursive:true});
 const samples=[['en','Welcome back! Ready for the next round?'],['zh-CN','欢迎回来！准备好下一局了吗？'],['zh-TW','歡迎回來！準備好下一局了嗎？'],['ja','おかえり！次のゲームを始めよう。'],['ko','어서 와요! 다음 게임을 시작해요.']];
 for(const [language,text] of samples){
  const start=Date.now(),response=await fetch(endpoint+'/speech',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({language,text,reference}),signal:AbortSignal.timeout(190000)});
  if(!response.ok)throw new Error(language+' HTTP '+response.status);
  const audio=Buffer.from(await response.arrayBuffer());assert(waveDuration(audio)>0);assert(!waveIsSilent(audio),'Silent voice: '+language);await fs.writeFile(path.join(out,language+'.wav'),audio);
  const row={language,text,elapsedMs:Date.now()-start,synthesisMs:Number(response.headers.get('X-Synthesis-Ms')),audioMs:Number(response.headers.get('X-Audio-Ms')),promptCached:response.headers.get('X-Voice-Prompt-Cached')==='true'};
  rows.push(row);console.log(JSON.stringify(row));await fs.writeFile(path.join(out,'benchmark.json'),JSON.stringify({at:new Date().toISOString(),device:health.device,realInference:true,reference:'English local test reference; not Astesi',liveDeadlineMs:25000,withinLiveDeadline:rows.every(row=>row.elapsedMs<25000),rows},null,2));
 }
 console.log('PASS real five-language generation; listening and live latency require separate acceptance.');
})().catch(e=>{console.error(e.message);process.exitCode=1;});
