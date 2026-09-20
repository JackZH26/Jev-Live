import type {Utterance,OverlayEvent} from '../shared/hosting';
/** Retry only before playback starts. A reconnect never replays an already-started line. */
export class OverlayAudio {
 level=0;private context?:AudioContext;private source?:AudioBufferSourceNode;private analyser?:AnalyserNode;
 private current='';private attempts=0;private retryAt=0;private busy=false;private generation=0;private played='';private controller?:AbortController;
 constructor(private prefix:string,private report:(kind:OverlayEvent,code?:string)=>void,private currentSpeech:()=>Utterance|null|undefined){try{this.played=sessionStorage.getItem('jev-last-played')??'';}catch{}}
 stop(interrupted=false){this.generation++;this.controller?.abort();if(this.source){this.source.onended=null;try{this.source.stop();this.source.disconnect();}catch{}if(interrupted)this.report('interrupted');}this.source=undefined;this.analyser?.disconnect();this.analyser=undefined;this.level=0;}
 async sync(speech:Utterance|null|undefined){
  if(!speech||Date.now()>=speech.expires){if(this.current){this.stop(!!this.source);this.current='';}return;}
  if(speech.id!==this.current){this.stop(!!this.source);this.current=speech.id;this.attempts=0;this.retryAt=0;}
  if(!speech.audio||this.played===speech.id||this.busy||Date.now()<this.retryAt||this.attempts>=3)return;
  this.busy=true;this.attempts++;const generation=this.generation,controller=new AbortController();this.controller=controller;
  const relevant=()=>generation===this.generation&&this.currentSpeech()?.id===speech.id&&Date.now()<speech.expires;
  try{
   this.context??=new AudioContext();await this.context.resume();if(this.context.state!=='running')throw new Error('suspended');
   const r=await fetch(`${this.prefix}/audio/${speech.audio}`,{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(5000)])});if(!r.ok)throw new Error('http_'+r.status);
   const data=await r.arrayBuffer();if(data.byteLength>20_000_000)throw new Error('oversize');
   const buffer=await this.context.decodeAudioData(data);if(!relevant())return;
   const source=this.context.createBufferSource();source.buffer=buffer;this.analyser=this.context.createAnalyser();this.analyser.fftSize=256;source.connect(this.analyser);this.analyser.connect(this.context.destination);this.source=source;
   source.onended=()=>{if(this.source!==source)return;source.disconnect();this.source=undefined;this.analyser?.disconnect();this.analyser=undefined;this.level=0;this.report('ended');};
   source.start();this.played=speech.id;try{sessionStorage.setItem('jev-last-played',speech.id);}catch{}
   this.report('started');if(this.attempts>1)this.report('recovered');
  }catch(e){if(!controller.signal.aborted&&relevant()){this.report('audioError',e instanceof Error&&/^(suspended|http_\d+|oversize)$/.test(e.message)?e.message:'fetch_or_decode');this.retryAt=Date.now()+Math.min(4000,700*2**(this.attempts-1));if(this.attempts>=3)this.report('expired');}}
  finally{this.busy=false;}
 }
 sample(){if(!this.analyser)return this.level=0;const values=new Uint8Array(this.analyser.fftSize);this.analyser.getByteTimeDomainData(values);return this.level=Math.sqrt(values.reduce((sum,v)=>sum+(v-128)**2,0)/values.length)/128;}
 close(){this.stop();void this.context?.close();}
}
