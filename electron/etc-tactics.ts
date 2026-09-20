import type { EtcObservation } from '../shared/etc';

/** Cloud objectives are bounded leases, independent of the native input heartbeat. */
export class EtcTactics {
  private match='';private session='';private epoch=-1;private room=-1;
  private intent='';private until=0;private requestedSignature='';private lastRequest=0;
  private failed=new Map<string,number>();
  private visits=new Map<number,number>();
  private history:{room:number;health:number;action:string;status:string}[]=[];
  private previous?:EtcObservation;private observedAt=0;private roomSince=0;private objectiveSince=0;
  private scoutMs=0;private distanceCm=0;private damageAt=0;private damageSequence=0;
  private discoveries=new Set<string>();
  reset(){this.match='';this.session='';this.epoch=-1;this.room=-1;this.intent='';this.until=0;this.requestedSignature='';this.lastRequest=0;this.failed.clear();this.visits.clear();this.history=[];this.previous=undefined;this.observedAt=0;this.roomSince=0;this.objectiveSince=0;this.scoutMs=0;this.distanceCm=0;this.damageAt=0;this.damageSequence=0;this.discoveries.clear();}
  observe(o:EtcObservation,epoch:number,now:number){
    if(o.matchId!==this.match||o.session!==this.session||epoch!==this.epoch){this.reset();this.match=o.matchId;this.session=o.session;this.epoch=epoch;}
    if(this.room!==o.self.room){this.room=o.self.room;this.intent='';this.until=0;this.failed.clear();this.visits.set(this.room,(this.visits.get(this.room)??0)+1);this.roomSince=now;this.scoutMs=0;this.distanceCm=0;this.previous=undefined;this.discoveries.clear();}
    const previous=this.previous;
    if(previous&&o.phase==='playing'&&previous.phase==='playing'&&!o.self.traveling&&!previous.self.traveling){
      const elapsed=Math.max(0,Math.min(250,now-this.observedAt));
      if(previous.executor?.objective==='scan'&&previous.executor.status==='running')this.scoutMs+=elapsed;
      const distance=Math.hypot(o.self.position[0]-previous.self.position[0],o.self.position[1]-previous.self.position[1]);
      if(distance<1000)this.distanceCm+=distance; // Exclude teleports/corrections, not an odometer.
      if(o.self.health<previous.self.health){this.damageAt=now;this.damageSequence++;}
    }
    // New visible enemies/supplies are productive scouting. Re-seeing the same actor is not.
    for(const action of o.actions)if(this.discoveries.size<512&&['engage','loot','pickup'].includes(action.kind)&&!this.discoveries.has(action.id)){
      this.discoveries.add(action.id);
      this.scoutMs=0;
    }
    if(!previous||previous.executor?.objective!==o.executor?.objective)this.objectiveSince=now;
    this.previous=structuredClone(o);this.observedAt=now;
    const e=o.executor;
    if(e?.status==='blocked'&&e.objective)this.failed.set(e.objective,now+5000);
    if(e&&e.objective===this.intent&&['blocked','succeeded','released'].includes(e.status)){this.intent='';this.until=0;}
    for(const [id,until] of this.failed)if(until<=now)this.failed.delete(id);
    const item={room:o.self.room,health:Math.round(o.self.health),action:e?.objective??o.diagnostics.lastAction,status:e?.status??'legacy'};
    if(JSON.stringify(item)!==JSON.stringify(this.history.at(-1))){this.history.push(item);if(this.history.length>12)this.history.shift();}
  }
  options(o:EtcObservation){
    const choices=o.actions.filter(a=>a.safe&&!this.failed.has(a.id)&&['engage','cover','loot','pickup','portal','scan'].includes(a.kind));
    // A room with no new observations must not keep winning "scan" forever.
    // Keep scanning available when there is no safe actionable alternative.
    return this.scoutMs>=12000&&choices.some(a=>['portal','loot','pickup','engage'].includes(a.kind))
      ?choices.filter(a=>a.kind!=='scan'):choices;
  }
  advice(o:EtcObservation,now:number){return now<this.until&&this.options(o).some(a=>a.id===this.intent)?this.intent:undefined;}
  shouldRequest(o:EtcObservation,now:number,interval:number){
    const signature=JSON.stringify([o.self.room,o.self.danger,o.enemies.map(e=>e.id).sort(),o.executor?.objective,o.executor?.status,o.self.magazine===0,o.self.health<o.self.maxHealth*.4,this.damageSequence,this.scoutMs>=12000]);
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
  context(){return {recent:this.history.map(item=>({...item})),visitedRooms:[...this.visits].map(([room,count])=>({room,count})),failedObjectives:[...this.failed.keys()],currentObjective:this.intent,
    progress:{roomSeconds:Math.max(0,this.observedAt-this.roomSince)/1000,objectiveSeconds:Math.max(0,this.observedAt-this.objectiveSince)/1000,
      sampledRoomDistanceM:Math.round(this.distanceCm)/100,unproductiveScoutSeconds:this.scoutMs/1000,
      damageSecondsAgo:this.damageAt?Math.max(0,this.observedAt-this.damageAt)/1000:null}};}
}
