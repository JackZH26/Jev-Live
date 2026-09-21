import {waveIsSilent} from './speech';

export interface VoiceReference {audio:string;text:string}
export const maxReferenceBytes=4_000_000;

// Keep imported voices private and accept only bounded PCM audio, never URLs or model files.
export function validateVoiceReference(data:Buffer){
 const invalid=()=>new Error('host.voiceReferenceInvalid');
 if(data.length<44||data.length>maxReferenceBytes||data.toString('ascii',0,4)!=='RIFF'||data.toString('ascii',8,12)!=='WAVE'||data.readUInt32LE(4)+8!==data.length)throw invalid();
 let frames=0,rate=0,channels=0,block=0,format=false,foundData=false;
 for(let at=12;at<data.length;){
  if(at+8>data.length)throw invalid();
  const length=data.readUInt32LE(at+4),id=data.toString('ascii',at,at+4),next=at+8+length+(length%2);
  if(next>data.length)throw invalid();
  if(id==='fmt '){
   if(format||length<16)throw invalid();
   channels=data.readUInt16LE(at+10);rate=data.readUInt32LE(at+12);block=data.readUInt16LE(at+20);
   if(data.readUInt16LE(at+8)!==1||data.readUInt16LE(at+22)!==16||![1,2].includes(channels)||rate<16000||rate>48000||block!==channels*2||data.readUInt32LE(at+16)!==rate*block)throw invalid();
   format=true;
  }
  if(id==='data'){
   if(!format||foundData||length%block)throw invalid();
   frames=length/block;foundData=true;
  }
  at=next;
 }
 const seconds=frames/rate;
 if(!foundData||seconds<3||seconds>20||waveIsSilent(data))throw invalid();
 return seconds;
}

export function validReferenceText(text:string){return text.trim().length>=10&&text.length<=2000&&/[a-zA-Z]/.test(text)&&!/[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/.test(text);}
