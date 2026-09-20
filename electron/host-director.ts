import type {ChatMessage,HostConfig} from '../shared/hosting';
export interface Direction {reason:'opening'|'change'|'ambient';phase:string;maxCharacters:number;mood:'neutral'|'focused'|'curious';previousPhase?:string}
/** Scheduling only. It never controls the game or invents events. */
export class HostDirector {
 private phase='';private candidate='';private candidateAt=0;private previous='';private changed=false;private spoke=false;private lastPlatform='';
 private viewers=new Map<string,{at:number,question:string,answer:string}>();
 reset(){this.phase='';this.candidate='';this.changed=false;this.spoke=false;this.viewers.clear();this.lastPlatform='';}
 observe(context:string,now:number){let next='unknown';try{const v=JSON.parse(context);if(v.connected&&['menu','loading','playing','ended','paused'].includes(v.phase))next=v.phase;}catch{}
  if(next!==this.candidate){this.candidate=next;this.candidateAt=now;}
  if(next!==this.phase&&now-this.candidateAt>=3000){this.previous=this.phase;this.phase=next;this.changed=!!this.previous&&this.previous!==next;}
 }
 direction(config:HostConfig,now:number,lastComment:number):Direction|undefined{
  const phase=this.phase||'unknown',factor={calm:1.8,balanced:1,lively:.7}[config.pace];
  const interval=this.changed?Math.max(15,config.intervalSec/2):Math.max(15,config.intervalSec*factor)*(phase==='playing'?1:3);
  if(this.spoke&&now-lastComment<interval*1000)return;
  return {reason:!this.spoke?'opening':this.changed?'change':'ambient',phase,maxCharacters:phase==='playing'?90:180,mood:phase==='playing'?'focused':phase==='menu'?'curious':'neutral',...(this.changed?{previousPhase:this.previous}:{})};
 }
 commented(){this.spoke=true;this.changed=false;}
 choose(pending:ChatMessage[],now:number){
  for(const [key,value] of this.viewers)if(now-value.at>1800000)this.viewers.delete(key);
  const available=pending.map((m,index)=>({m,index,previous:this.viewers.get(m.platform+':'+m.authorId)})).filter(({m,previous})=>!previous||now-previous.at>=30000&&(m.text.trim()!==previous.question||now-previous.at>=120000));
  const next=available.find(({m})=>m.platform!==this.lastPlatform)??available[0];if(!next)return;
  pending.splice(next.index,1);this.lastPlatform=next.m.platform;let similar=1;
  for(let i=pending.length-1;i>=0;i--)if(pending[i].platform===next.m.platform&&pending[i].text.trim()===next.m.text.trim()){pending.splice(i,1);similar++;}
  return {message:next.m,similar,previous:next.previous?{question:next.previous.question,answer:next.previous.answer}:undefined};
 }
 answered(message:ChatMessage,answer:string,now:number){this.viewers.set(message.platform+':'+message.authorId,{at:now,question:message.text.trim(),answer:answer.slice(0,350)});while(this.viewers.size>200)this.viewers.delete(this.viewers.keys().next().value!);}
}
