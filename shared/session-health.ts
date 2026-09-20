import type {OutputState,Provider} from './types';import type {OverlayHealth} from './hosting';
export type HealthIssue='framesStalled'|'overlayStale'|'blackFrame'|'frozenFrame';
/** These are warnings, not permission to restart a game or interrupt a stream. */
export class SessionHealth {
 readonly issues:Partial<Record<Provider,HealthIssue[]>>={};
 private samples:Partial<Record<Provider,{frames:number;startedAt:number;progressAt:number;image:string;imageAt:number;blackAt:number}>>={};
 sample(provider:Provider,output:OutputState,overlay:OverlayHealth,hosting:boolean,now:number,image?:{signature:string;black:boolean}){
  if(!output.active){delete this.samples[provider];delete this.issues[provider];return;}
  const previous=this.samples[provider]??{frames:output.frames,startedAt:now,progressAt:now,image:'',imageAt:now,blackAt:now};
  if(output.frames!==previous.frames){previous.frames=output.frames;previous.progressAt=now;}
  if(image){if(image.signature!==previous.image){previous.image=image.signature;previous.imageAt=now;}if(!image.black)previous.blackAt=now;}
  const issues:HealthIssue[]=[];
  if(!output.reconnecting&&now-previous.progressAt>20000)issues.push('framesStalled');
  if(hosting&&now-(overlay.lastSeen||previous.startedAt)>10000)issues.push('overlayStale');
  if(image?.black&&now-previous.blackAt>30000)issues.push('blackFrame');
  if(image&&now-previous.imageAt>180000)issues.push('frozenFrame');
  this.samples[provider]=previous;this.issues[provider]=issues;
 }
}
