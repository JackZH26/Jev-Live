import { ETC_MAX_AGE_MS, type EtcAction, type EtcObservation } from '../shared/etc';
import {canDefendRoom} from './etc-knowledge';

/** Retire acknowledged pickups/chests even when the native offer lingers. */
export class EtcCompletedActions {
  private identity='';private known=new Map<string,string>();
  private completed=new Map<string,{at:number;absentAt?:number}>();
  reset(){this.identity='';this.known.clear();this.completed.clear();}
  observe(o:EtcObservation,now:number){
    const identity=o.session+':'+o.matchId;if(identity!==this.identity){this.reset();this.identity=identity;}
    const present=new Set(o.actions.map(a=>a.id));
    for(const a of o.actions){this.known.set(a.id,a.kind);while(this.known.size>256)this.known.delete(this.known.keys().next().value!);}
    for(const [id,entry] of this.completed){
      if(present.has(id))entry.absentAt=undefined;else entry.absentAt??=now;
      if(now-entry.at>120000||entry.absentAt!==undefined&&now-entry.absentAt>=2000)this.completed.delete(id);
    }
    const e=o.executor;
    if(e?.status==='succeeded'&&['pickup','loot'].includes(this.known.get(e.objective)??'')&&!this.completed.has(e.objective)){
      this.completed.set(e.objective,{at:now});while(this.completed.size>256)this.completed.delete(this.completed.keys().next().value!);
    }
  }
  allows(id:string){return !this.completed.has(id);}
}

/** Only observed affordances enter the policy. No world actors, hidden HP or future collapse schedule. */
export class EtcPolicy {
  private completed=new EtcCompletedActions();
  private match = '';
  private lastRoom = -1;
  private visits = new Map<number,number>();
  private active = '';
  private activeAt = 0;
  private failed = new Map<string,number>();
  private health:number|undefined;
  private hurtAt=-Infinity;
  private seenAt=-Infinity;
  private progressAt=0;
  private bestDistance=Infinity;
  private coverAt=-Infinity;private coveredObjective='';private startRoom='';
  private guardAt=0;private reconUntil=0;
  reset(){this.match='';this.lastRoom=-1;this.visits.clear();this.active='';this.activeAt=0;this.failed.clear();this.health=undefined;this.hurtAt=-Infinity;this.seenAt=-Infinity;this.progressAt=0;this.bestDistance=Infinity;this.completed.reset();this.coverAt=-Infinity;this.coveredObjective='';this.startRoom='';this.guardAt=0;this.reconUntil=0;}
  choose(o:EtcObservation, now:number, autoRestart:boolean, played:boolean, advice?:string, planned?:EtcAction):EtcAction|undefined {
    if(o.matchId!==this.match){this.reset();this.match=o.matchId;}
    const wait = o.actions.find(a=>a.kind==='wait');
    if(now-o.timestamp>ETC_MAX_AGE_MS||o.timestamp>now+50||!o.foreground)return wait;
    if(o.phase==='loading'&&o.roomPick){
      const choices=o.actions.filter(a=>a.kind==='pick_room'&&a.safe);
      if(o.roomPick.locked>=0)return wait;
      // Only public pick-screen supplies/connectivity, never hidden room types or spawns.
      if(!choices.some(a=>a.id===this.startRoom))this.startRoom=choices.map(a=>({a,r:o.roomPick!.rooms.find(r=>r.id===a.destination)}))
        .sort((a,b)=>{const score=(r:typeof a.r)=>r?Math.min(r.exits,3)*8+Math.min(r.loot,8)*3-(r.hotspot?7:0):0;return score(b.r)-score(a.r)||a.a.id.localeCompare(b.a.id);})[0]?.a.id??'';
      return choices.find(a=>a.id===this.startRoom)??wait;
    }
    if(o.phase==='menu'||o.phase==='dead'||o.phase==='ended'){
      if(played&&o.phase!=='menu'&&!o.result)return wait;
      return (!played||autoRestart)?o.actions.find(a=>a.kind==='new_match')??wait:wait;
    }
    if(o.phase!=='playing'||o.self.health<=0||o.self.traveling)return wait;
    this.completed.observe(o,now);
    if(o.self.room!==this.lastRoom){this.lastRoom=o.self.room;this.visits.set(o.self.room,(this.visits.get(o.self.room)??0)+1);this.coverAt=-Infinity;this.coveredObjective='';this.guardAt=now;this.reconUntil=0;}
    if(o.executor?.status==='succeeded'&&o.executor.reason==='cover_reached'&&this.coveredObjective!==o.executor.objective){this.coverAt=now;this.coveredObjective=o.executor.objective;}
    if(o.executor?.status==='blocked'&&o.executor.objective){this.failed.set(o.executor.objective,now+5000);if(this.active===o.executor.objective)this.active='';}
    else if(!o.executor&&o.diagnostics.stuck&&this.active){this.failed.set(this.active,now+5000);this.active='';}
    for(const [id,until] of this.failed)if(until<=now)this.failed.delete(id);
    const continuing=o.actions.find(a=>a.id===this.active);
    // An in-flight jump cannot safely take an unrelated route or map command.
    // Identity, foreground, death and manual takeover remain outside this hold.
    if(o.self.grounded===false&&o.executor?.status==='running'){
      const physical=o.actions.find(a=>a.id===o.executor!.objective&&a.safe);
      if(physical&&['portal','loot','pickup','scan','cover'].includes(physical.kind))return this.select(physical,now);
    }
    if(continuing&&['portal','loot','pickup'].includes(continuing.kind)&&o.executor?.objective===this.active&&o.executor.status==='running'){
      if(continuing.distance<this.bestDistance-100){this.bestDistance=continuing.distance;this.progressAt=now;}
      else if(now-this.progressAt>20000){this.failed.set(this.active,now+5000);this.active='';}
    }
    const visible=o.enemies.length>0, low=o.self.health/o.self.maxHealth<0.4;
    // Losing the camera view is not proof that the attacker has stopped firing.
    // Remember only our own damage and actual sightings, never hidden actor state.
    if(this.health!==undefined&&o.self.health<this.health-.5)this.hurtAt=now;
    this.health=o.self.health;
    if(visible)this.seenAt=now;
    const underFire=now-this.hurtAt<5000, threatened=visible||underFire||now-this.seenAt<2000;
    const defending=canDefendRoom(o)&&!threatened;
    // Survival constraints have priority over cloud advice, loot and target persistence.
    // The shared motor already selects its loaded primary. Repeated optional
    // equip commands can fight that choice every tick (GL <-> AR in live traces).
    // Keep starter upgrades and empty-weapon emergency switches available.
    const nativeLoadedPrimary=o.executor?.kind==='shared-bot-v1'&&o.self.magazine>0&&!/StarterPistol|^$/.test(o.self.weapon);
    const eligible=o.actions.filter(a=>!['new_match','inspect_map','pick_room'].includes(a.kind)&&!this.failed.has(a.id)&&a.safe&&this.completed.allows(a.id)&&!(a.kind==='equip'&&nativeLoadedPrimary));
    const escape=eligible.filter(a=>a.kind==='portal');
    const escapeOrder=(a:EtcAction,b:EtcAction)=>(a.destinationRisk??0)-(b.destinationRisk??0)||a.distance-b.distance;
    const weakLoadout=/StarterPistol|^$/.test(o.self.weapon)||o.self.magazine<=0&&o.self.reserve<=0;
    // A yellow room without enemies is an evacuation order, including weak loadouts.
    if(o.self.danger&&escape.length)return this.select(planned&&escape.includes(planned)?planned:escape.sort(escapeOrder)[0],now);
    if(o.self.healing&&!threatened&&!o.self.danger)return wait;
    // Stabilize behind nearby verified cover, then allow a bounded counterattack.
    // Do not ping-pong between the same completed cover and an attack every tick.
    if(underFire&&visible&&(low||now-this.coverAt>2500)){
      const cover=eligible.filter(a=>a.kind==='cover'&&a.distance>150&&a.distance<=1400).sort((a,b)=>a.distance-b.distance)[0];
      if(cover)return this.select(cover,now);
    }
    if(!threatened&&!o.self.danger){
      const heal=eligible.filter(a=>a.kind==='heal').sort((a,b)=>(b.rank??0)-(a.rank??0))[0];
      if(heal&&o.self.health<o.self.maxHealth-1)return this.select(heal,now);
      const reload=eligible.find(a=>a.kind==='reload');
      if(reload&&o.self.reserve>0&&o.self.magazineCapacity!==undefined&&o.self.magazine<o.self.magazineCapacity)return this.select(reload,now);
      if(o.self.reloading)return wait;
      const upgrade=eligible.filter(a=>a.kind==='pickup'&&a.replacementSlot!==undefined&&a.distance<=3000).sort((a,b)=>(b.rank??0)-(a.rank??0)||a.distance-b.distance)[0];
      if(upgrade)return this.select(upgrade,now);
    }
    // A prepared player alternates holding cover with brief local observation,
    // preserving opportunities to see/fight arrivals without hopping hazards.
    if(defending){
      const scan=eligible.find(a=>a.kind==='scan');
      if(this.reconUntil&&now>=this.reconUntil){this.reconUntil=0;this.guardAt=now;}
      if(scan&&(this.reconUntil>now||now-this.guardAt>=18000)){
        if(!this.reconUntil)this.reconUntil=now+3000;
        return this.select(scan,now);
      }
    }else {this.guardAt=now;this.reconUntil=0;}
    // Moving uses the normal game's cast interruption. Do not restart a heal
    // each time incoming damage cancels it, or stand still awaiting cloud advice.
    if(underFire&&!visible){
      const retreat=eligible.filter(a=>a.kind==='cover'&&a.distance>150).sort((a,b)=>a.distance-b.distance)[0]
        ??escape.sort(escapeOrder)[0]
        ??eligible.find(a=>a.kind==='scan');
      if(retreat)return this.select(retreat,now);
    }
    // Return fire while a distant escape would leave us exposed. Cloud may
    // still select nearby cover/doors, and low health keeps retreat priority.
    const suggested=eligible.find(a=>a.id===advice);
    if(visible&&underFire&&!low&&o.self.magazine>0&&!o.self.protected
      &&!(suggested&&['cover','portal'].includes(suggested.kind)&&suggested.distance<=600)){
      const fight=eligible.filter(a=>a.kind==='engage').sort((a,b)=>a.distance-b.distance)[0];
      if(fight)return this.select(fight,now);
    }
    const supply=eligible.filter(a=>a.distance<=3000&&(a.kind==='pickup'||a.kind==='loot')).sort((a,b)=>
      (b.kind==='pickup'?35+(b.rank??0)*4:0)-(a.kind==='pickup'?35+(a.rank??0)*4:0)||a.distance-b.distance)[0];
    // Let a progressing movement finish a short execution window. A new sighting,
    // damage or room danger interrupts immediately; cloud chatter alone does not.
    if(!threatened&&!o.self.danger&&now-this.activeAt<5000&&o.executor?.status==='running'
      &&o.executor.objective===this.active&&continuing&&['loot','pickup','portal'].includes(continuing.kind)
      &&(!defending||continuing.kind!=='portal')
      &&!(continuing.destinationRisk??0)&&eligible.includes(continuing))return continuing;
    // A capable native motor executes a real tactical objective, not a +10 hint.
    // Only immediate survival/maintenance overrides it; healthy fighters may retreat.
    if(o.executor?.kind==='shared-bot-v1'&&advice&&!o.self.danger){
      const tactical=eligible.find(a=>a.id===advice&&(['engage','cover','loot','pickup','portal','scan'].includes(a.kind)||defending&&a.kind==='wait'));
      const emergency=visible&&low&&eligible.some(a=>a.kind==='cover')
        ||o.self.magazine===0&&eligible.some(a=>a.kind==='equip'||a.kind==='reload'&&o.self.reserve>0)
        ||!threatened&&o.self.health<o.self.maxHealth*.8&&eligible.some(a=>a.kind==='heal')
        ||!threatened&&eligible.some(a=>a.kind==='equip')
        ||!threatened&&weakLoadout&&supply&&supply.distance<=3000;
      const legal=tactical&&(tactical.kind!=='engage'||visible&&o.self.magazine>0&&!o.self.protected)
        &&!(defending&&tactical.kind==='portal')
        &&!(tactical.kind==='portal'&&(tactical.destinationRisk??0)>=2&&escape.some(a=>a.destinationRisk===0))
        &&(!threatened||!['loot','pickup','scan'].includes(tactical.kind));
      if(legal&&!emergency)return this.select(tactical,now);
    }
    const score=(a:EtcAction)=>{
      const distance=a.distance/100; // UE centimetres -> metres
      let n=-1000;
      switch(a.kind){
        case 'wait': n=defending?65:-100;break;
        case 'scan': n=0;break;
        case 'engage': n=visible&&o.self.magazine>0&&!o.self.protected?90-distance*0.6: -1000;break;
        case 'cover': n=threatened?(low||o.self.magazine===0?160:65)-distance: -80;break;
        // Seven shells may already be a full shotgun. No hardcoded magazine capacity.
        case 'reload': n=o.self.reserve>0?(o.self.magazine===0?130:-60):-1000;break;
        case 'heal': n=!threatened&&o.self.health<o.self.maxHealth*0.8?110:-1000;break;
        case 'equip': n=(o.self.magazine===0?145:!visible?85:25)+(a.rank??0);break;
        case 'pickup': n=(weakLoadout?125:55)+(a.rank??0)*4-distance;break;
        case 'loot': n=(weakLoadout?90:o.self.reserve>=30&&/AR0|MG0|SR0/.test(o.self.weapon)?10:40)-distance*0.5;break;
        case 'portal': n=Math.max(5,30-distance*0.1-Math.min(20,6*(this.visits.get(a.destination??-1)??0)))-30*(a.destinationRisk??0)+(planned?.id===a.id?5:0);break;
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
  private select(a:EtcAction|undefined,now:number){if(a&&a.id!==this.active){this.active=a.id;this.activeAt=now;this.progressAt=now;this.bestDistance=a.distance;}return a;}
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
