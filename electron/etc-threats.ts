import type {EtcAction,EtcObservation} from '../shared/etc';

// Steam API v3 exposes visible pawns with their native actor identity. Machines
// are non-competitors; their hidden health, target and deployment plan are never read.
export const isMechanical=(id:string)=>/^EtcMechanicalPawn(?:_|$)/i.test(id);
export function openingTie(match:string,id:string){
  let hash=2166136261;for(const c of match+':'+id)hash=Math.imul(hash^c.charCodeAt(0),16777619);return hash>>>0;
}
export function threatPriority(action:EtcAction,o:EtcObservation){
  const id=action.target??action.id.replace(/^engage_/,'');
  const machine=isMechanical(id);
  // A very close machine can block us. Otherwise favor a comparable competitor
  // instead of turning away to farm drone damage while a player can shoot us.
  return action.distance/100+(machine?(action.distance<=800?-12:18):0);
}
export class EtcThreats {
  private identity='';private health:number|undefined;private damage:{at:number;amount:number}[]=[];
  reset(){this.identity='';this.health=undefined;this.damage=[];}
  observe(o:EtcObservation,now:number){
    const identity=o.session+':'+o.matchId;if(identity!==this.identity){this.reset();this.identity=identity;}
    if(this.health!==undefined&&o.self.health<this.health)this.damage.push({at:now,amount:this.health-o.self.health});
    this.health=o.self.health;this.damage=this.damage.filter(d=>now-d.at<=1500);
    const machines=o.enemies.filter(e=>isMechanical(e.id)),players=o.enemies.filter(e=>!isMechanical(e.id));
    const burstDamage=this.damage.reduce((sum,d)=>sum+d.amount,0);
    const ratio=o.self.health/o.self.maxHealth;
    return {machines,players,burstDamage,
      overwhelming:o.enemies.length>=3||players.length>=2&&ratio<.7,
      lethalPressure:burstDamage>=o.self.maxHealth*.3&&ratio<=.6,
      ammoScarce:o.self.magazine+Math.max(0,o.self.reserve)<Math.max(12,(o.self.magazineCapacity??12)*1.5),
    };
  }
}
