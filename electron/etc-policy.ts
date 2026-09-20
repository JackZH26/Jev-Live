import { ETC_MAX_AGE_MS, type EtcAction, type EtcObservation } from '../shared/etc';

/** Only observed affordances enter the policy. No world actors, hidden HP or future collapse schedule. */
export class EtcPolicy {
  private match = '';
  private lastRoom = -1;
  private visits = new Map<number,number>();
  private active = '';
  private activeAt = 0;
  private failed = new Map<string,number>();
  reset(){this.match='';this.lastRoom=-1;this.visits.clear();this.active='';this.activeAt=0;this.failed.clear();}
  choose(o:EtcObservation, now:number, autoRestart:boolean, played:boolean, advice?:string):EtcAction|undefined {
    if(o.matchId!==this.match){this.reset();this.match=o.matchId;}
    const wait = o.actions.find(a=>a.kind==='wait');
    if(now-o.timestamp>ETC_MAX_AGE_MS||o.timestamp>now+50||!o.foreground)return wait;
    if(o.phase==='menu'||o.phase==='dead'||o.phase==='ended'){
      if(played&&o.phase!=='menu'&&!o.result)return wait;
      return (!played||autoRestart)?o.actions.find(a=>a.kind==='new_match')??wait:wait;
    }
    if(o.phase!=='playing'||o.self.health<=0||o.self.traveling)return wait;
    if(o.self.room!==this.lastRoom){this.lastRoom=o.self.room;this.visits.set(o.self.room,(this.visits.get(o.self.room)??0)+1);}
    if(o.diagnostics.stuck&&this.active){this.failed.set(this.active,now+5000);this.active='';}
    for(const [id,until] of this.failed)if(until<=now)this.failed.delete(id);
    const visible=o.enemies.length>0, low=o.self.health/o.self.maxHealth<0.4;
    // Survival constraints have priority over cloud advice, loot and target persistence.
    const eligible=o.actions.filter(a=>a.kind!=='new_match'&&!this.failed.has(a.id)&&a.safe);
    const escape=eligible.filter(a=>a.kind==='portal');
    if(o.self.danger&&escape.length)return this.select(escape.sort((a,b)=>a.distance-b.distance)[0],now);
    if(o.self.healing&&!visible&&!o.self.danger)return wait;
    const score=(a:EtcAction)=>{
      const distance=a.distance/100; // UE centimetres -> metres
      let n=-1000;
      switch(a.kind){
        case 'wait': n=-100;break;
        case 'scan': n=0;break;
        case 'engage': n=visible&&o.self.magazine>0&&!o.self.protected?90-distance*0.6: -1000;break;
        case 'cover': n=visible?(low||o.self.magazine===0?160:65)-distance: -80;break;
        case 'reload': n=o.self.reserve>0?(o.self.magazine===0?130:!visible&&o.self.magazine<8?70:-60):-1000;break;
        case 'heal': n=!visible&&o.self.health<o.self.maxHealth*0.8?110:-1000;break;
        case 'equip': n=(o.self.magazine===0?145:!visible?85:25)+(a.rank??0);break;
        case 'pickup': n=(o.self.magazine<=0&&o.self.reserve<=0?125:55)+(a.rank??0)*4-distance;break;
        case 'loot': n=(o.self.magazine<=0&&o.self.reserve<=0?100:o.self.reserve>=30&&/AR0|MG0|SR0/.test(o.self.weapon)?10:40)-distance*0.5;break;
        case 'portal': n=Math.max(5,30-distance*0.1-Math.min(20,6*(this.visits.get(a.destination??-1)??0)));break;
      }
      if(o.self.danger&&a.kind!=='portal')n-=200;
      if(visible&&['loot','pickup','portal'].includes(a.kind)&&!o.self.danger)n-=80;
      // Bounded tactical advice cannot reverse immediate survival priorities.
      if(a.id===advice&&!o.self.danger&&!low)n+=10;
      if(a.id===this.active&&now-this.activeAt<1200)n+=8;
      return n;
    };
    const chosen=eligible.map(a=>({a,n:score(a)})).sort((a,b)=>b.n-a.n||a.a.id.localeCompare(b.a.id))[0];
    return this.select(chosen?.a??wait,now);
  }
  private select(a:EtcAction|undefined,now:number){if(a&&a.id!==this.active){this.active=a.id;this.activeAt=now;}return a;}
}

export class EtcMetrics {
  frames=0;decisions=0;lastLatencyMs=0;matches=0;wins=0;losses=0;interrupted=0;lastPlacement:number|null=null;
  private samples:number[]=[];private match='';private finished=new Set<string>();private lastFrame=-1;private eligible=false;
  observe(o:EtcObservation,auto=true){
    if(o.frame===this.lastFrame)return;this.lastFrame=o.frame;this.frames++;
    if(o.phase==='playing'&&o.matchId&&o.matchId!==this.match){
      if(this.match&&!this.finished.has(this.match))this.interrupted++;
      this.match=o.matchId;this.eligible=auto;
    }
    if(o.phase==='playing'&&!auto)this.eligible=false;
    if(o.result&&o.matchId===this.match&&!this.finished.has(o.matchId)){
      this.finished.add(o.matchId);
      if(!this.eligible){this.interrupted++;return;}
      this.matches++;this.wins+=Number(o.result.won);this.losses+=Number(!o.result.won);this.lastPlacement=o.result.placement;
    }
  }
  decision(timestamp:number,now:number){this.decisions++;this.lastLatencyMs=Math.max(0,now-timestamp);this.samples.push(this.lastLatencyMs);if(this.samples.length>2000)this.samples.shift();}
  get p95LatencyMs(){const sorted=[...this.samples].sort((a,b)=>a-b);return sorted[Math.max(0,Math.ceil(sorted.length*.95)-1)]??0;}
}
