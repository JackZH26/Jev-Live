import {it,expect} from 'vitest';
import {EtcPolicy} from '../electron/etc-policy';
import {etcObservationSchema,type EtcObservation} from '../shared/etc';
const time=100000;
function state():EtcObservation{return {version:3,appId:'5272970',session:'s',matchId:'m',timestamp:time,frame:1,processId:1,phase:'playing',mode:'auto',epoch:1,ack:1,foreground:true,map:'match',
 self:{position:[0,0,90],health:100,maxHealth:100,magazine:7,magazineCapacity:7,reserve:28,weapon:'SG02',protected:false,traveling:false,healing:false,room:1,roomType:18,danger:false,evacuationSeconds:-1,kills:0},enemies:[],
 actions:[{id:'wait',kind:'wait',safe:true,distance:0},{id:'scan',kind:'scan',safe:true,distance:0},{id:'reload',kind:'reload',safe:true,distance:0},{id:'heal',kind:'heal',safe:true,distance:0},{id:'portal',kind:'portal',safe:true,distance:800,destinationRisk:0}],result:null,diagnostics:{heldInputs:0,shots:0,stuck:false,observationMs:1,lastAction:'wait'},executor:{kind:'shared-bot-v1',objective:'wait',status:'running',reason:'accepted',failures:0,pathStatus:0}};}
it('tops up a partial magazine when safe but never reloads a full shotgun or guesses its capacity',()=>{
 const p=new EtcPolicy(),o=state();expect(p.choose(o,time,false,true)?.kind).not.toBe('reload');
 o.self.magazine=4;expect(p.choose(o,time,false,true)?.kind).toBe('reload');
 delete o.self.magazineCapacity;expect(new EtcPolicy().choose(o,time,false,true)?.kind).not.toBe('reload');
});
it('prioritizes white-room evacuation over healing, topping up and a weapon upgrade',()=>{
 const o=state();o.self.danger=true;o.self.health=50;o.self.magazine=2;
 o.actions.push({id:'better',kind:'pickup',safe:true,distance:200,rank:5,replacementSlot:1});
 expect(new EtcPolicy().choose(o,time,false,true,'better')?.id).toBe('portal');
});
it('heals a safe wounded player and waits through the actual cast',()=>{
 const p=new EtcPolicy(),o=state();o.self.health=90;expect(p.choose(o,time,false,true)?.kind).toBe('heal');
 o.self.healing=true;expect(p.choose(o,time,false,true)?.kind).toBe('wait');
 o.self.danger=true;expect(p.choose(o,time,false,true)?.kind).toBe('portal');
});
it('chooses the offered recovery utility rather than the first consumable in key order',()=>{
 const o=state();o.self.health=25;o.actions=o.actions.filter(a=>a.kind!=='heal');
 o.actions.push({id:'gauze',kind:'heal',safe:true,distance:0,rank:4},{id:'medkit',kind:'heal',safe:true,distance:0,rank:6});
 expect(new EtcPolicy().choose(o,time,false,true)?.id).toBe('medkit');
 o.self.gauzeActive=true;o.self.health=70;o.actions=o.actions.filter(a=>a.kind!=='heal');
 expect(new EtcPolicy().choose(o,time,false,true)?.kind).not.toBe('heal');
});
it('takes nearby cover after damage, then returns fire without repeatedly selecting completed cover',()=>{
 const p=new EtcPolicy(),o=state();o.enemies=[{id:'enemy',distance:1400,position:[1400,0,90],velocity:[0,0,0]}];
 o.actions.push({id:'fight',kind:'engage',safe:true,distance:1400},{id:'shelter',kind:'cover',safe:true,distance:500});
 p.choose(o,time,false,true,'fight');o.self.health=88;o.timestamp+=50;
 expect(p.choose(o,o.timestamp,false,true,'fight')?.id).toBe('shelter');
 o.executor={...o.executor!,objective:'shelter',status:'succeeded',reason:'cover_reached'};o.actions.find(a=>a.id==='shelter')!.distance=50;o.timestamp+=800;
 expect(p.choose(o,o.timestamp,false,true,'fight')?.id).toBe('fight');
});
it('keeps an in-progress nearby cover approach instead of swapping shelters each damage tick',()=>{
 const p=new EtcPolicy(),o=state();o.enemies=[{id:'enemy',distance:1400,position:[1400,0,90],velocity:[0,0,0]}];
 o.actions.push({id:'fight',kind:'engage',safe:true,distance:1400},{id:'a',kind:'cover',safe:true,distance:500},{id:'b',kind:'cover',safe:true,distance:700});
 p.choose(o,time,false,true,'fight');o.self.health=80;o.timestamp+=50;expect(p.choose(o,o.timestamp,false,true)?.id).toBe('a');
 o.executor={...o.executor!,objective:'a',status:'running'};o.actions.find(a=>a.id==='b')!.distance=400;o.timestamp+=200;
 expect(p.choose(o,o.timestamp,false,true,'b')?.id).toBe('a');
});
it('rejects cloud advice to abandon a loaded favorable fight for distant cover',()=>{
 const o=state();o.enemies=[{id:'enemy',distance:1400,position:[1400,0,90],velocity:[0,0,0]}];
 o.actions.push({id:'fight',kind:'engage',safe:true,distance:1400},{id:'far',kind:'cover',safe:true,distance:4500});
 expect(new EtcPolicy().choose(o,time,false,true,'far')?.id).toBe('fight');
});
it('does not heal or top up immediately after taking damage even if the attacker leaves the camera',()=>{
 const p=new EtcPolicy(),o=state();p.choose(o,time,false,true);o.self.health=90;o.self.magazine=4;o.timestamp+=50;
 expect(['heal','reload']).not.toContain(p.choose(o,o.timestamp,false,true)?.kind);
 o.timestamp+=5100;expect(p.choose(o,o.timestamp,false,true)?.kind).toBe('heal');
});
it('prioritizes a verified better replacement while safe and preserves the fixed sidearm',()=>{
 const o=state();o.actions.push({id:'better',kind:'pickup',safe:true,distance:350,rank:4,replacementSlot:2});
 expect(new EtcPolicy().choose(o,time,false,true)?.id).toBe('better');
 expect(etcObservationSchema.safeParse({...o,actions:[{...o.actions.at(-1)!,replacementSlot:0}]}).success).toBe(false);
});
it('selects supplies and multiple exits from the visible starting map and leaves a confirmed lock alone',()=>{
 const p=new EtcPolicy(),o=state();o.phase='loading';o.roomPick={locked:-1,secondsLeft:8,rooms:[{id:0,exits:1,loot:1,hotspot:false},{id:1,exits:3,loot:5,hotspot:false}]};
 o.actions.push({id:'pick0',kind:'pick_room',safe:true,distance:0,destination:0},{id:'pick1',kind:'pick_room',safe:true,distance:0,destination:1});
 expect(p.choose(o,time,false,false)?.id).toBe('pick1');o.roomPick.locked=1;expect(p.choose(o,time,false,false)?.id).toBe('wait');
 o.foreground=false;o.roomPick.locked=-1;expect(p.choose(o,time,false,false)?.id).toBe('wait');
});
it('interrupts prolonged safe guarding with bounded local reconnaissance, and evacuates immediately if warned',()=>{
 const p=new EtcPolicy(),o=state();expect(p.choose(o,time,false,true)?.kind).toBe('wait');
 o.timestamp+=18001;expect(p.choose(o,o.timestamp,false,true,'wait')?.kind).toBe('scan');
 o.timestamp+=1000;expect(p.choose(o,o.timestamp,false,true,'wait')?.kind).toBe('scan');
 o.self.danger=true;expect(p.choose(o,o.timestamp,false,true,'scan')?.kind).toBe('portal');
});
