const {chromium}=require('playwright'),fs=require('node:fs/promises'),path=require('node:path');
const out=path.resolve(process.argv[2]??'test-results/chat-lab-2026-09-21'),pause=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const session=JSON.parse(await fs.readFile(path.join(out,'session.json'),'utf8')),base=session.url.replace(/\/$/,''),origin=new URL(base).origin;
 const browser=await chromium.launch({headless:true,args:['--autoplay-policy=no-user-gesture-required']});const page=await browser.newPage({viewport:{width:390,height:844}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const api=async(name,body={})=>{const r=await fetch(base+'/'+name,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});const value=await r.json();if(!r.ok)throw Error(value.error);return value;};
 const state=async()=>await(await fetch(base+'/state')).json();
 async function until(fn,timeout=60000){const start=Date.now();while(Date.now()-start<timeout){const s=await state();if(await fn(s))return s;await pause(250);}throw Error('Timed out waiting for model/speech/playback');}
 const samples=[];
 try{
  await page.goto(session.url);await page.waitForSelector('iframe');
  // A reproducible captured loadout question; this is functional sampling, not a population benchmark.
  await api('start',{pace:'quiet',seed:1487});await until(s=>s.injected>=1);await api('pause');
  let before=await state();const first=before.messages[0];let s=await until(s=>s.utterance?.replyTo===first.id&&s.overlay.twitch.audioEnded>=1);
  samples.push({kind:'captured',comment:first.text,reply:s.utterance.text,language:s.utterance.language,timing:s.timing,utteranceId:s.utterance.id});console.log(JSON.stringify({sample:'captured',language:s.utterance.language,played:true}));
  const inputs=[['en','What game is this?'],['zh-CN','你会优先捡装备还是先找掩体？'],['zh-TW','你喜歡先找掩體還是找裝備？'],['ja','どの武器が好きですか？'],['ko','어떤 무기가 좋아요?'],['en','¿Cuál es tu arma favorita?']];
  for(const [language,text] of inputs){
   await until(s=>!s.utterance||Date.now()>s.utterance.expires+100);before=await state();
   const provider=samples.length%2?'youtube':'twitch',started=before.overlay[provider].audioStarted,ended=before.overlay[provider].audioEnded;
   const accepted=await api('message',{text,platform:provider}),message=accepted.messages.at(-1);
   s=await until(s=>s.utterance?.replyTo===message.id&&s.overlay[provider].audioStarted>started&&s.overlay[provider].audioEnded>ended);
   if(s.utterance.language!==language||!require('../dist-main/shared/reply-language').matchesReplyLanguage(s.utterance.text,language))throw Error('Incorrect output text or speech language');
   const other=provider==='youtube'?'twitch':'youtube';if(s.overlay[other].audioStarted!==before.overlay[other].audioStarted)throw Error('Reply leaked across platforms');
   samples.push({kind:'synthetic',comment:text,reply:s.utterance.text,language:s.utterance.language,provider,timing:s.timing,utteranceId:s.utterance.id});console.log(JSON.stringify({sample:samples.length,language,played:true,modelMs:s.timing.modelMs,speechMs:s.timing.speechMs}));
  }
  for(const language of ['en','zh-CN','zh-TW','ja','ko']){await page.selectOption('#language',language);if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Mobile page overflows');}
  await page.selectOption('#language','zh-CN');await page.screenshot({path:path.join(out,'mobile.png'),fullPage:true});
  const final=await state();if(errors.length||final.stats.failures||Object.values(final.overlay).some(o=>o.audioErrors))throw Error('Runtime or audio errors');
  const report={passed:true,pipelinePassed:true,contentQualityAccepted:false,scope:'Real local Ollama + Melo + production OverlayAudio in Chromium; archived and synthetic chat; no real platform delivery, factual-quality acceptance or live game validation',dataset:final.dataset,samples,stats:final.stats,overlay:final.overlay,browserErrors:errors};await fs.writeFile(path.join(out,'acceptance.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({pipelinePassed:true,contentQualityAccepted:false,samples:samples.length,report:path.join(out,'acceptance.json')}));
 }catch(e){await fs.writeFile(path.join(out,'acceptance-failure.json'),JSON.stringify({passed:false,error:e.message,samples,browserErrors:errors},null,2));throw e;}
 finally{await api('stop').catch(()=>{});await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
