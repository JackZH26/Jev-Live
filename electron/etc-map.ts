import {ETC_MAX_AGE_MS,type EtcObservation,type EtcAction} from '../shared/etc';
import {EtcKnowledge} from './etc-knowledge';
type MapView=NonNullable<EtcObservation['mapView']>;
export type RoomRoute={goal:number;rooms:number[];cost:number;seconds:number;score:number};
/** Map knowledge is a snapshot of the real M overlay, never the hidden collapse schedule. */
export class EtcMapPlanner {
  readonly knowledge=new EtcKnowledge();
  private lastRoom=-1;
  private match='';private key='';private before=new Set<string>();private revision=0;
  private health:number|undefined;private hurtUntil=0;private pending='';private requestAt=0;
  private lastBlocked=0;private reviewCooldown=0;private failedReviews=0;private preferred:number|undefined;
  view:MapView|undefined;routes:RoomRoute[]=[];route:RoomRoute|undefined;
  reason='initial';lastReviewReason='';
  reset(){this.match='';this.key='';this.before.clear();this.revision=0;this.health=undefined;this.hurtUntil=0;this.pending='';this.requestAt=0;this.lastBlocked=0;this.reviewCooldown=0;this.failedReviews=0;this.preferred=undefined;this.view=undefined;this.routes=[];this.route=undefined;this.reason='initial';this.lastReviewReason='';}
  observe(o:EtcObservation,now:number){
    if(this.match!==o.matchId){this.reset();this.match=o.matchId;}
    if(this.lastRoom!==o.self.room&&this.route?.rooms.length===1)this.preferred=undefined;
    this.lastRoom=o.self.room;
    this.knowledge.observe(o);
    if(this.health!==undefined&&o.self.health<this.health-.5)this.hurtUntil=now+3000;
    this.health=o.self.health;
    const key=o.zone?`${o.zone.phase}:${o.zone.stage}`:'';
    if(key!==this.key){this.key=key;this.preferred=undefined;this.route=undefined;}
    const m=o.mapView;
    if(m&&m.revision>this.revision&&m.observedAt<=now+50&&m.observedAt>=0){
      this.view=structuredClone(m);this.revision=m.revision;
      this.lastReviewReason=this.pending||'manual_map';
      if(this.pending==='before_refresh'&&`${m.phase}:${m.stage}`===key)this.before.add(key);
      this.pending='';this.failedReviews=0;this.reviewCooldown=now+2500;
    }
    // A offered map action can fail in a shipped client. Repeatedly renewing
    // that blocked action freezes the opening instead of collecting a weapon.
    if(this.pending&&(now-this.requestAt>4000||o.executor?.objective==='inspect_map'&&o.executor.status==='blocked')){
      this.pending='';this.failedReviews++;this.reviewCooldown=now+Math.min(60000,15000*2**(this.failedReviews-1));
    }
    this.routes=this.compute(o);
    this.route=this.routes.find(r=>r.goal===this.preferred)??this.routes[0];
    if(this.route)this.preferred=this.route.goal;
  }
  review(o:EtcObservation,now:number):EtcAction|undefined {
    if(!o.zone||o.phase!=='playing'||!o.foreground||now-o.timestamp>ETC_MAX_AGE_MS||o.self.traveling)return;
    const action=o.actions.find(a=>a.kind==='inspect_map'&&a.safe);if(!action)return;
    // A visible threat, damage, or the final evacuation seconds preempt the overlay.
    if(o.enemies.length||now<this.hurtUntil||o.self.healing||o.self.grounded===false||o.self.evacuationSeconds>0&&o.self.evacuationSeconds<5)return;
    if(o.mapView?.open&&o.executor?.objective==='inspect_map'&&o.executor.status==='running')return action;
    if(this.pending)return action;
    if(now<this.reviewCooldown)return;
    const snapshotKey=this.view?`${this.view.phase}:${this.view.stage}`:'';
    let reason=!this.view?'initial':snapshotKey!==this.key?'after_refresh':'';
    if(!reason&&o.zone.secondsLeft>=0&&o.zone.secondsLeft<=Math.max(20,this.knowledge.crossingSeconds(o.self.room)+8)&&!this.before.has(this.key))reason='before_refresh';
    const failures=o.executor?.failures??0;
    if(!reason&&failures-this.lastBlocked>=3&&now-this.requestAt>15000)reason='route_blocked';
    if(!reason)return;
    this.reason=reason;this.pending=reason;this.requestAt=now;this.lastBlocked=failures;
    return action;
  }
  private compute(o:EtcObservation):RoomRoute[]{
    const m=this.view;if(!m||!o.zone||`${m.phase}:${m.stage}`!==this.key)return [];
    const byId=new Map(m.rooms.map(r=>[r.id,r]));if(!byId.has(o.self.room))return [];
    const graph=new Map<number,number[]>();for(const [a,b]of m.edges){if(!byId.has(a)||!byId.has(b)||byId.get(a)!.risk===4||byId.get(b)!.risk===4)continue;graph.set(a,[...(graph.get(a)||[]),b]);graph.set(b,[...(graph.get(b)||[]),a]);}
    const cost=new Map([[o.self.room,0]]),times=new Map([[o.self.room,0]]),paths=new Map([[o.self.room,[o.self.room]]]),pending=new Set([o.self.room]);
    while(pending.size){const current=[...pending].sort((a,b)=>cost.get(a)!-cost.get(b)!)[0];pending.delete(current);
      for(const next of graph.get(current)||[]){
        const room=byId.get(next)!;
        // Map timing is approximate; reserve time for door interaction and hazards.
        const seconds=times.get(current)!+this.knowledge.crossingSeconds(current);
        if(room.risk===1&&o.zone.stage==='warning'&&o.zone.secondsLeft>=0&&seconds+this.knowledge.crossingSeconds(next)+8>=o.zone.secondsLeft)continue;
        const n=cost.get(current)!+this.knowledge.crossingSeconds(current)/30+room.risk*8;
        if(n<(cost.get(next)??Infinity)){cost.set(next,n);times.set(next,seconds);paths.set(next,[...paths.get(current)!,next]);pending.add(next);}
      }
    }
    const routes:RoomRoute[]=[];
    for(const [goal,rooms]of paths){const room=byId.get(goal)!;if(room.risk!==0)continue;
      const safeExits=(graph.get(goal)||[]).filter(n=>byId.get(n)!.risk===0).length;
      const seconds=times.get(goal)!;
      // Safe connected rooms beat dead ends; distance keeps the plan achievable.
      const score=cost.get(goal)!*2-Math.min(4,safeExits)*3+(room.visited?1:0);
      routes.push({goal,rooms,cost:cost.get(goal)!,seconds,score});
    }
    return routes.sort((a,b)=>a.score-b.score||a.seconds-b.seconds||a.goal-b.goal).slice(0,8);
  }
  next(o:EtcObservation):EtcAction|undefined {
    const r=this.route;if(!r||r.rooms[0]!==o.self.room||r.rooms.length<2)return;
    return o.actions.find(a=>a.kind==='portal'&&a.safe&&a.destination===r.rooms[1]);
  }
  accept(goal:number,source:EtcObservation,current:EtcObservation|null){
    if(!current||current.phase!=='playing'||current.mode!=='auto'||!current.foreground||source.session!==current.session||source.epoch!==current.epoch||source.matchId!==current.matchId||source.self.room!==current.self.room||source.mapView?.revision!==current.mapView?.revision||source.zone?.phase!==current.zone?.phase||source.zone?.stage!==current.zone?.stage)return false;
    const route=this.routes.find(r=>r.goal===goal);if(!route)return false;
    this.preferred=goal;this.route=route;this.reason='jev_target';return true;
  }
  context(){return {source:'M-map snapshot',observedAt:this.view?.observedAt??null,revision:this.revision,reason:this.reason,lastReviewReason:this.lastReviewReason,target:this.route?.goal??null,route:this.route?.rooms??[],estimatedSeconds:this.route?.seconds??null,candidates:this.routes,map:this.view?{rooms:this.view.rooms,edges:this.view.edges}:null};}
}
