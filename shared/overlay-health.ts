import {overlayEvents,type OverlayEvent,type OverlayHealth} from './hosting';
export function recordOverlayEvent(health:OverlayHealth,event:string,code:string){
 if(!overlayEvents.includes(event as OverlayEvent))return false;
 if(event==='started')health.audioStarted++;
 else if(event==='ended')health.audioEnded++;
 else if(event==='recovered')health.recovered++;
 else if(event==='expired')health.expired++;
 else if(event==='interrupted')health.interrupted++;
 else {const audio=event==='audioError';if(audio)health.audioErrors++;else health.stateErrors++;health.lastError={kind:audio?'audio':'state',code:/^[a-z0-9_-]{1,40}$/i.test(code)?code:'unknown',at:Date.now()};}
 return true;
}
