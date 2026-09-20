import type { EtcObservation } from '../shared/etc';

/** Cloud objectives are bounded leases, independent of the native input heartbeat. */
export class EtcTactics {
  private match='';private session='';private epoch=-1;private room=-1;
  private intent='';private until=0;private requestedSignature='';private lastRequest=0;
  private failed=new Map<string,number>();
  private visits=new Map<number,number>();
  private history:{room:number;health:number;action:string;status:string}[]=[];
  reset(){this.match='';this.session='';this.epoch=-1;this.room=-1;this.intent='';this.until=0;this.requestedSignature='';this.lastRequest=0;this.failed.clear();this.visits.clear();this.history=[];}
  observe(o:EtcObservation,epoch:number,now:number){
    if(o.matchId!==this.match||o.session!==this.session||epoch!==this.epoch){this.reset();this.match=o.matchId;this.session=o.session;this.epoch=epoch;}
    if(this.room!==o.self.room){this.room=o.self.room;this.intent='';this.until=0;this.failed.clear();this.visits.set(this.room,(this.visits.get(this.room)??0)+1);}
    const e=o.executor;
    if(e?.status==='blocked'&&e.objective)this.failed.set(e.objective,now+5000);
    if(e&&e.objective===this.intent&&['blocked','succeeded','released'].includes(e.status)){this.intent='';this.until=0;}
    for(const [id,until] of this.failed)if(until<=now)this.failed.delete(id);
    const item={room:o.self.room,health:Math.round(o.self.health),action:e?.objective??o.diagnostics.lastAction,status:e?.status??'legacy'};
    if(JSON.stringify(item)!==JSON.stringify(this.history.at(-1))){this.history.push(item);if(this.history.length>12)this.history.shift();}
  }
  options(o:EtcObservation){return o.actions.filter(a=>a.safe&&!this.failed.has(a.id)&&['engage','cover','loot','pickup','portal','scan'].includes(a.kind));}
  advice(o:EtcObservation,now:number){return now<this.until&&this.options(o).some(a=>a.id===this.intent)?this.intent:undefined;}
  shouldRequest(o:EtcObservation,now:number,interval:number){
    const signature=JSON.stringify([o.self.room,o.self.danger,o.enemies.map(e=>e.id).sort(),o.executor?.objective,o.executor?.status,o.self.magazine===0,o.self.health<o.self.maxHealth*.4]);
    const elapsed=now-this.lastRequest;
    if(elapsed<800||(!(signature!==this.requestedSignature||!this.advice(o,now))&&elapsed<Math.max(800,interval)))return false;
    this.lastRequest=now;this.requestedSignature=signature;return true;
  }
  accept(id:string,source:EtcObservation,current:EtcObservation|null,epoch:number,now:number){
    if(!current||epoch!==this.epoch||source.epoch!==epoch||current.epoch!==epoch||source.session!==this.session||source.matchId!==this.match||current.session!==source.session||current.matchId!==source.matchId||current.self.room!==source.self.room||current.phase!=='playing'||current.mode!=='auto'||!current.foreground||now-source.timestamp>1500||now-current.timestamp>250||current.timestamp>now+50)return false;
    if(!this.options(source).some(a=>a.id===id)||!this.options(current).some(a=>a.id===id))return false;
    const e=current.executor;
    if(e?.objective===id&&['succeeded','blocked','released'].includes(e.status))return false;
    this.intent=id;this.until=now+4000;return true;
  }
  context(){return {recent:this.history,visitedRooms:[...this.visits].map(([room,count])=>({room,count})),failedObjectives:[...this.failed.keys()],currentObjective:this.intent};}
}
