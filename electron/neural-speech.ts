import {randomBytes} from 'node:crypto';
import {waveDuration,waveIsSilent} from './speech';
type NeuralProvider='qwen'|'melo';
const endpoint=(provider:NeuralProvider)=>provider==='melo'?'http://127.0.0.1:11437':'http://127.0.0.1:11435';
export async function neuralSpeech(text:string,voice:string,language:string,signal:AbortSignal,provider:NeuralProvider='qwen'){
 signal.throwIfAborted();
 const response=await fetch(endpoint(provider)+'/speech',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:text.slice(0,350),voice:provider==='melo'?'':voice,language}),redirect:'error',signal:AbortSignal.any([signal,AbortSignal.timeout(35000)])});
 if(!response.ok||!response.headers.get('Content-Type')?.startsWith('audio/wav'))throw new Error('host.neuralUnavailable');
 const reader=response.body?.getReader();if(!reader)throw new Error('host.neuralUnavailable');const chunks:Uint8Array[]=[];let length=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>4_000_000)throw new Error('host.neuralUnavailable');chunks.push(value);}}catch(e){await reader.cancel().catch(()=>{});throw e;}
 signal.throwIfAborted();const data=Buffer.concat(chunks);const duration=waveDuration(data);if(duration>40||waveIsSilent(data))throw new Error('host.neuralUnavailable');return {id:randomBytes(16).toString('hex')+'.wav',data,duration};
}
export async function neuralHealth(provider:NeuralProvider='qwen'){try{const response=await fetch(endpoint(provider)+'/health',{redirect:'error',signal:AbortSignal.timeout(1500)});if(!response.ok)return false;const value=await response.json() as any;return value.ready===true&&value.provider===(provider==='melo'?'melo':'qwen3-tts');}catch{return false;}}
