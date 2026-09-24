import {it,expect} from 'vitest';
import {EtcPolicy} from '../electron/etc-policy';
import {EtcThreats,isMechanical} from '../electron/etc-threats';
import type {EtcObservation,EtcAction} from '../shared/etc';
const a=(id:string,kind:EtcAction['kind'],distance=0,extra:Partial<EtcAction>={}):EtcAction=>({id,kind,distance,safe:true,...extra});
function state():EtcObservation{return {version:3,appId:'5272970',session:'s',matchId:'m',timestamp:100000,frame:1,processId:1,phase:'playing',mode:'auto',epoch:1,ack:1,foreground:true,map:'m',self:{position:[0,0,90],health:100,maxHealth:100,magazine:30,magazineCapacity:30,reserve:90,weapon:'AR01',protected:false,traveling:false,healing:false,room:1,roomType:18,danger:false,evacuationSeconds:-1,kills:0},enemies:[],actions:[a('wait','wait'),a('scan','scan'),a('exit','portal',800,{destinationRisk:0})],result:null,diagnostics:{heldInputs:0,shots:0,stuck:false,observationMs:0,lastAction:''},executor:{kind:'shared-bot-v1',objective:'wait',status:'running',reason:'accepted',failures:0,pathStatus:0}};}
function enemy(o:EtcObservation,id:string,distance:number){o.enemies.push({id,distance,position:[distance,0,90],velocity:[0,0,0]});o.actions.push(a('engage_'+id,'engage',distance,{target:id}));}
it('recognizes the actual mechanical actor class without guessing from player names',()=>{
 expect(isMechanical('EtcMechanicalPawn_21474')).toBe(true);expect(isMechanical('Player_drone_master')).toBe(false);
});
it('prioritizes a comparable visible competitor over a drone, including cloud advice',()=>{
 const o=state();enemy(o,'EtcMechanicalPawn_1',1200);enemy(o,'LyraCharacter_2',1400);
 expect(new EtcPolicy().choose(o,o.timestamp,false,true,'engage_EtcMechanicalPawn_1')?.target).toBe('LyraCharacter_2');
});
it('handles a very close mechanical threat first and never manufactures an attack on an unseen drone',()=>{
 const o=state();enemy(o,'EtcMechanicalPawn_1',500);enemy(o,'LyraCharacter_2',2000);
 expect(new EtcPolicy().choose(o,o.timestamp,false,true)?.target).toBe('EtcMechanicalPawn_1');
 o.enemies=[];o.actions=o.actions.filter(a=>a.kind!=='engage');expect(new EtcPolicy().choose(o,o.timestamp,false,true)?.kind).not.toBe('engage');
});
it('leaves distant mechanical attrition through a nearby white exit when ammunition is scarce',()=>{
 const o=state();o.self.magazine=10;o.self.reserve=5;enemy(o,'EtcMechanicalPawn_1',2000);
 expect(new EtcPolicy().choose(o,o.timestamp,false,true,'engage_EtcMechanicalPawn_1')?.id).toBe('exit');
 o.actions.find(a=>a.id==='exit')!.destinationRisk=2;
 expect(new EtcPolicy().choose(o,o.timestamp,false,true)?.id).not.toBe('exit');
});
it('uses cover under lethal burst damage even when a cloud attack is still valid',()=>{
 const o=state(),p=new EtcPolicy();enemy(o,'enemy',1400);o.actions.push(a('cover','cover',500));p.choose(o,o.timestamp,false,true);
 o.timestamp+=300;o.self.health=55;expect(p.choose(o,o.timestamp,false,true,'engage_enemy')?.kind).toBe('cover');
});
it('takes nearby cover against three visible firing lanes',()=>{
 const o=state();for(let i=0;i<3;i++)enemy(o,'enemy'+i,1800+i*200);o.actions.push(a('cover','cover',500));
 expect(new EtcPolicy().choose(o,o.timestamp,false,true)?.kind).toBe('cover');
});
it('clears damage pressure between matches and after its brief window',()=>{
 const o=state(),p=new EtcThreats();p.observe(o,o.timestamp);o.self.health=50;o.timestamp+=50;expect(p.observe(o,o.timestamp).lethalPressure).toBe(true);
 o.timestamp+=1600;expect(p.observe(o,o.timestamp).lethalPressure).toBe(false);o.matchId='next';o.self.health=40;expect(p.observe(o,o.timestamp).burstDamage).toBe(0);
});
it('varies equally viable openings across matches, holds its choice within a match, and avoids a hotspot',()=>{
 const picks=new Set<string>();
 for(let n=0;n<40;n++){
  const o=state();o.phase='loading';o.matchId='match-'+n;
  o.roomPick={locked:-1,secondsLeft:10,rooms:Array.from({length:8},(_,id)=>({id,exits:3,loot:3,hotspot:id===7}))};
  o.actions.push(...o.roomPick.rooms.map(r=>a('pick_'+r.id,'pick_room',0,{destination:r.id})));
  const p=new EtcPolicy(),first=p.choose(o,o.timestamp,false,false)!;
  expect(first.destination).not.toBe(7);picks.add(first.id);
  expect(p.choose(o,o.timestamp+50,false,false)?.id).toBe(first.id);
 }
 expect(picks.size).toBeGreaterThan(2);
});
