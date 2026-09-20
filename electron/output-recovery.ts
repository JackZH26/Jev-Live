import type {Provider,OutputState} from '../shared/types';
export interface RecoveryStatus{state:'healthy'|'waiting'|'recovering'|'failed';attempts:number;nextAt:number}
/** Session ownership is explicit; a stopped stream can never be resurrected by a late retry. */
export class OutputRecovery {
 readonly status:Partial<Record<Provider,RecoveryStatus>>={};
 private desired:Provider[]=[];private controller=new AbortController();private pending?:Promise<void>;
 constructor(private repair:(provider:Provider,signal:AbortSignal)=>Promise<void>){}
 start(providers:Provider[]){this.controller.abort();this.controller=new AbortController();this.desired=[...providers];for(const p of Object.keys(this.status) as Provider[])delete this.status[p];}
 async stop(){this.desired=[];this.controller.abort();await this.pending;}
 tick(outputs:Record<Provider,OutputState>,now=Date.now()){
  if(this.pending||this.controller.signal.aborted||!this.desired.length)return;
  const signal=this.controller.signal;
  this.pending=(async()=>{for(const provider of this.desired){if(signal.aborted)return;const output=outputs[provider];let state=this.status[provider];
   if(output.connected&&output.active&&!output.reconnecting){this.status[provider]={state:'healthy',attempts:0,nextAt:0};continue;}
   if(output.reconnecting){this.status[provider]={state:'waiting',attempts:state?.attempts??0,nextAt:now+10000};continue;}
   if(!state||state.state==='healthy'){this.status[provider]={state:'waiting',attempts:0,nextAt:now+10000};continue;}
   if(state.state==='failed'||now<state.nextAt)continue;
   state.state='recovering';state.attempts++;
   try{await this.repair(provider,signal);if(signal.aborted)return;state.state='waiting';state.nextAt=now+10000;}
   catch{if(signal.aborted)return;state.state=state.attempts>=5?'failed':'waiting';state.nextAt=now+Math.min(60000,2000*2**state.attempts);}
  }})().finally(()=>{this.pending=undefined;});
 }
 async settled(){await this.pending;}
}
