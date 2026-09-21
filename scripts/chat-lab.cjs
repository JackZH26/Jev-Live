// Local-only replay lab using the production Chat -> Hosting -> model -> TTS -> Overlay pipeline.
const fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http'),{randomBytes}=require('node:crypto');
const root=path.resolve(__dirname,'..'),{Hosting}=require('../dist-main/electron/hosting'),{OverlayServer}=require('../dist-main/electron/overlay-server'),{Store}=require('../dist-main/electron/storage'),{replayDatasetSchema,replaySchedule}=require('../dist-main/shared/chat-replay');
const args=process.argv.slice(2),arg=name=>args.find(a=>a.startsWith('--'+name+'='))?.slice(name.length+3);
const datasetPath=path.resolve(arg('dataset')??'test-results/chat-fixtures/pubg-captured.json'),directory=path.resolve(arg('output')??path.join('test-results','chat-lab-'+Date.now()));
async function main(){
 await fs.mkdir(directory,{recursive:true});const data=await fs.readFile(datasetPath);if(data.length>16_000_000)throw Error('Dataset too large');const dataset=replayDatasetSchema.parse(JSON.parse(data));
 const store=new Store(directory,{isEncryptionAvailable:()=>true,encryptString:()=>{throw Error('No credentials in replay lab');},decryptString:()=>{throw Error('No credentials in replay lab');}});await store.init();
 const context={game:'Enter the Cube Playtest',connected:false,phase:'unknown',simulation:true,visibleText:'LOCAL CHAT REPLAY: no live game observation is attached. Imported PUBG comments are audience statements from a different historical game stream. Never describe their claims as current game facts. Discuss general gameplay or ask a brief relevant question.'};
 const host=new Hosting(store,{credentials:async()=>{throw Error('External account access forbidden in replay lab');}},()=>JSON.stringify(context),()=>undefined,()=>undefined,'simulation');
 await host.init();await host.save({...host.config,language:'en',compute:arg('compute')==='auto'?'auto':'cpu',speechProvider:'melo',chatPlatforms:[],commentary:false,textReplies:true,replyCooldownSec:5,maxPerHour:240,persona:'A relaxed gaming streamer. Reply naturally to the selected viewer in the requested language, usually one short sentence. Do not greet on every reply. Do not pretend to have seen a historical chat event. Use at most 70 Chinese/Japanese/Korean characters or 24 English words.'});
 const overlay=new OverlayServer(host,path.join(root,'dist'));await overlay.start();
 const token=randomBytes(24).toString('hex'),base='/'+token;let address='',timer,clock=0,schedule=[],index=0,run=0,mode='normal',seed=21;
 const receipts=[],played=[],audioSaved=new Set(),replySaved=new Set();let journal=Promise.resolve(),lastError='';
 const record=(kind,value)=>{journal=journal.then(()=>fs.appendFile(path.join(directory,'events.ndjson'),JSON.stringify({...value,kind,at:value.at??Date.now()})+'\n')).catch(()=>{lastError='Could not write replay receipt';});};
 const stopReplay=()=>{clearInterval(timer);timer=undefined;};
 const info=()=>({simulation:true,running:host.running,warming:host.warming,replaying:!!timer,pace:mode,seed,injected:receipts.length,dataset:{game:dataset.game,count:dataset.messages.length,captured:dataset.messages.filter(m=>m.kind==='captured').length,synthetic:dataset.messages.filter(m=>m.kind==='synthetic').length,description:dataset.description,sources:dataset.sources},messages:host.chat.messages.slice(-60),utterance:host.utterance,stats:host.stats,timing:host.timing,overlay:host.overlay,replies:host.chat.simulatedReplies.slice(-30),played:played.slice(-30),error:host.error||lastError,overlayURLs:{twitch:overlay.url('twitch'),youtube:overlay.url('youtube')}});
 const inject=row=>{const now=Date.now(),id=`replay-${run}-${receipts.length}-${row.id}`;host.chat.ingestReplay({id,platform:row.platform,authorId:row.viewer,author:'[SIM] '+row.viewer,text:row.text,at:now,self:false});const receipt={id,sourceId:row.id,kind:row.kind,text:row.text,language:require('../dist-main/shared/reply-language').replyLanguage(row.text),platform:row.platform,at:now};receipts.push(receipt);if(receipts.length>20000)receipts.shift();record('received',receipt);};
 async function body(req){let text='';for await(const chunk of req){text+=chunk;if(text.length>4096)throw Error('Request too large');}return text?JSON.parse(text):{};}
 const server=http.createServer(async(req,res)=>{try{
  const hostHeader=new URL(address).host;if(req.headers.host!==hostHeader){res.writeHead(403).end();return;}
  const url=new URL(req.url,address);if(!url.pathname.startsWith(base+'/')){res.writeHead(404).end();return;}
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
  const route=url.pathname.slice(base.length);
  if(req.method==='GET'&&route==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(await fs.readFile(path.join(__dirname,'chat-lab.html')));return;}
  if(req.method==='GET'&&route==='/state'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(info()));return;}
  if(req.method!=='POST'||req.headers.origin!==address){res.writeHead(403).end();return;}
  const value=await body(req);
  if(route==='/start'){
   if(host.warming)throw Error('Model is still warming');stopReplay();if(!host.running)await host.start();
   mode=['quiet','normal','burst','original'].includes(value.pace)?value.pace:'normal';seed=Number.isInteger(value.seed)?value.seed:21;schedule=replaySchedule(dataset,mode,seed);index=0;run++;clock=Date.now();
   timer=setInterval(()=>{const elapsed=Date.now()-clock;let batch=0;while(index<schedule.length&&schedule[index].dueMs<=elapsed&&batch++<50)inject(schedule[index++]);if(index===schedule.length)stopReplay();},100);
  }else if(route==='/pause')stopReplay();
  else if(route==='/stop'){stopReplay();host.stop();}
  else if(route==='/message'){
   if(!host.running)throw Error('Start the local host first');if(typeof value.text!=='string'||!value.text.trim()||value.text.length>600)throw Error('Invalid message');
   inject({id:'manual',viewer:'Local tester '+(++run),text:value.text,kind:'synthetic',platform:value.platform==='youtube'?'youtube':'twitch'});
  }else if(route==='/playback'){
   if(!['started','ended','interrupted'].includes(value.kind)||typeof value.id!=='string'||!audioSaved.has(value.id))throw Error('Unknown playback receipt');
   const row={id:value.id,kind:value.kind,at:Date.now()};played.push(row);if(played.length>500)played.shift();record('browserPlayback',row);
  }else {res.writeHead(404).end();return;}
  res.setHeader('Content-Type','application/json');res.end(JSON.stringify(info()));
 }catch(e){res.writeHead(400,{'Content-Type':'application/json'}).end(JSON.stringify({error:e.message}));}});
 await new Promise(r=>server.listen(Number(arg('port')??0),'127.0.0.1',r));address='http://127.0.0.1:'+server.address().port;
 overlay.allowLocalPreview(address);
 const poll=setInterval(()=>{
  const u=host.utterance;
  if(u?.audio&&!audioSaved.has(u.id)){const audio=host.audioData(u.audio);if(audio){audioSaved.add(u.id);journal=journal.then(async()=>{await fs.writeFile(path.join(directory,u.id+'.wav'),audio);await fs.appendFile(path.join(directory,'events.ndjson'),JSON.stringify({kind:'utterance',...u,audioFile:u.id+'.wav',timing:{...host.timing}})+'\n');}).catch(()=>{lastError='Could not save speech';});}}
  for(const reply of host.chat.simulatedReplies)if(!replySaved.has(reply.id)){replySaved.add(reply.id);record('reply',reply);}
 },100);
 await fs.writeFile(path.join(directory,'session.json'),JSON.stringify({url:address+base+'/',datasetPath,simulation:true,language:'en',replyLanguage:'Match supported comment language; otherwise English'},null,2));
 console.log(JSON.stringify({url:address+base+'/',output:directory,count:dataset.messages.length,simulation:true}));
 let closing=false;const close=async()=>{if(closing)return;closing=true;stopReplay();clearInterval(poll);host.stop();overlay.close();server.closeAllConnections();server.close();await journal;await fs.writeFile(path.join(directory,'report.json'),JSON.stringify({simulation:true,scope:'Local production model/TTS/overlay; no real platform delivery',stats:host.stats,overlay:host.overlay,received:receipts.length,replies:host.chat.simulatedReplies,played,error:lastError},null,2));process.exit(0);};process.on('SIGINT',close);process.on('SIGTERM',close);
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
