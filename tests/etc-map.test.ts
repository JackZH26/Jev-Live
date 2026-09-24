import {it,expect} from 'vitest';
import {EtcMapPlanner} from '../electron/etc-map';
import {EtcPolicy} from '../electron/etc-policy';
import type {EtcObservation} from '../shared/etc';
const now=100000;
function state():EtcObservation{return {version:3,appId:'5272970',session:'s',matchId:'m',timestamp:now,frame:1,processId:1,phase:'playing',mode:'auto',epoch:1,ack:1,foreground:true,map:'match',zone:{phase:1,stage:'warning',secondsLeft:60},self:{position:[0,0,0],health:100,maxHealth:100,magazine:20,reserve:60,weapon:'AR01',protected:false,traveling:false,healing:false,room:0,danger:true,evacuationSeconds:-1,kills:0},enemies:[],actions:[{id:'wait',kind:'wait',distance:0,safe:true},{id:'inspect_map',kind:'inspect_map',distance:0,safe:true},{id:'portal_a',kind:'portal',distance:500,safe:true,destination:1,destinationRisk:1},{id:'portal_b',kind:'portal',distance:900,safe:true,destination:3,destinationRisk:0}],result:null,diagnostics:{heldInputs:0,shots:0,stuck:false,observationMs:1,lastAction:'wait'},executor:{kind:'shared-bot-v1',objective:'wait',status:'running',reason:'accepted',failures:0,pathStatus:0}};}
function snapshot(o:EtcObservation){o.mapView={open:true,revision:1,observedAt:o.timestamp,phase:1,stage:'warning',rooms:[0,1,2,3,4].map(id=>({id,number:id+1,x:id,y:0,w:1,h:1,risk:id<2?1:0,visited:id===0})),edges:[[0,1],[1,2],[0,3],[3,4],[4,2]]};return o;}
it('opens the actual map initially, keeps the command until a snapshot, and reviews before and after each refresh',()=>{
 const p=new EtcMapPlanner(),o=state();p.observe(o,now);expect(p.review(o,now)?.kind).toBe('inspect_map');
 o.timestamp+=50;p.observe(o,o.timestamp);expect(p.review(o,o.timestamp)?.kind).toBe('inspect_map');
 snapshot(o);p.observe(o,o.timestamp);o.mapView!.open=false;o.timestamp+=3000;p.observe(o,o.timestamp);expect(p.review(o,o.timestamp)).toBeUndefined();
 o.zone!.secondsLeft=18;p.observe(o,o.timestamp);expect(p.review(o,o.timestamp)?.kind).toBe('inspect_map');
 o.mapView!.revision=2;o.mapView!.observedAt=o.timestamp;p.observe(o,o.timestamp);o.timestamp+=3000;p.observe(o,o.timestamp);expect(p.review(o,o.timestamp)).toBeUndefined();
 o.zone!.stage='collapse';o.zone!.secondsLeft=30;p.observe(o,o.timestamp);expect(p.route).toBeUndefined();expect(p.review(o,o.timestamp)?.kind).toBe('inspect_map');expect(p.reason).toBe('after_refresh');
});
it('defers map viewing during combat, recent damage and last-second evacuation',()=>{
 const p=new EtcMapPlanner(),o=state();o.enemies=[{id:'e',position:[0,0,0],velocity:[0,0,0],distance:100}];p.observe(o,now);expect(p.review(o,now)).toBeUndefined();
 o.enemies=[];o.self.health=90;o.timestamp+=50;p.observe(o,o.timestamp);expect(p.review(o,o.timestamp)).toBeUndefined();
 o.timestamp+=4000;o.self.evacuationSeconds=3;p.observe(o,o.timestamp);expect(p.review(o,o.timestamp)).toBeUndefined();
});
it('does not stop a jump to open the map and checks it once grounded',()=>{
 const p=new EtcMapPlanner(),o=state();o.self.grounded=false;p.observe(o,now);
 expect(p.review(o,now)).toBeUndefined();o.self.grounded=true;
 expect(p.review(o,now)?.kind).toBe('inspect_map');
});
it('prefers a safe multi-hop route and excludes yellow transit rooms that cannot be crossed before refresh',()=>{
 const p=new EtcMapPlanner(),o=snapshot(state());o.zone!.secondsLeft=12;p.observe(o,now);
 expect(p.routes.every(r=>!r.rooms.includes(1))).toBe(true);expect(p.next(o)?.id).toBe('portal_b');
 expect(new EtcPolicy().choose(o,now,false,true,undefined,p.next(o))?.id).toBe('portal_b');
});
it('never uses a collapsed edge or accepts a cloud goal from a different snapshot or phase',()=>{
 const p=new EtcMapPlanner(),o=snapshot(state());o.mapView!.rooms[1].risk=4;p.observe(o,now);expect(p.routes.every(r=>!r.rooms.includes(1))).toBe(true);
 const current=structuredClone(o);current.mapView!.revision++;expect(p.accept(3,o,current)).toBe(false);current.mapView!.revision--;current.zone!.stage='collapse';expect(p.accept(3,o,current)).toBe(false);expect(p.accept(3,o,o)).toBe(true);
});
it('does not fabricate a route before a real map snapshot and clears previous matches',()=>{
 const p=new EtcMapPlanner(),o=state();p.observe(o,now);expect(p.route).toBeUndefined();snapshot(o);p.observe(o,now);expect(p.route).toBeDefined();o.matchId='new';delete o.mapView;p.observe(o,now);expect(p.route).toBeUndefined();
});
it('releases an unavailable map immediately and backs off while local actions continue',()=>{
 const p=new EtcMapPlanner(),o=state();p.observe(o,now);expect(p.review(o,now)?.kind).toBe('inspect_map');
 o.timestamp+=1800;o.executor={...o.executor!,objective:'inspect_map',status:'blocked',reason:'map_unavailable'};
 p.observe(o,o.timestamp);expect(p.review(o,o.timestamp)).toBeUndefined();
 expect(new EtcPolicy().choose(o,o.timestamp,false,true)?.kind).toBe('portal');
 o.timestamp+=14000;p.observe(o,o.timestamp);expect(p.review(o,o.timestamp)).toBeUndefined();
 o.timestamp+=1100;o.executor!.objective='portal_a';p.observe(o,o.timestamp);expect(p.review(o,o.timestamp)?.kind).toBe('inspect_map');
 o.timestamp+=1800;o.executor!.objective='inspect_map';p.observe(o,o.timestamp);expect(p.review(o,o.timestamp)).toBeUndefined();
 o.timestamp+=16000;p.observe(o,o.timestamp);expect(p.review(o,o.timestamp)).toBeUndefined();
});
it('budgets known hazard traversal and requests the pre-refresh map early enough',()=>{
 const p=new EtcMapPlanner(),o=snapshot(state());o.self.roomType=11;p.observe(o,now);
 expect(p.routes.find(r=>r.goal===3)?.seconds).toBe(55);
 o.mapView!.open=false;o.timestamp+=3000;o.zone!.secondsLeft=58;p.observe(o,o.timestamp);
 expect(p.review(o,o.timestamp)?.kind).toBe('inspect_map');expect(p.reason).toBe('before_refresh');
});
it('does not pull exploration back toward a destination that was already reached',()=>{
 const p=new EtcMapPlanner(),o=snapshot(state());p.observe(o,now);expect(p.accept(3,o,o)).toBe(true);
 o.self.room=3;p.observe(o,now);expect(p.route?.rooms).toEqual([3]);
 o.self.room=4;p.observe(o,now);expect(p.route?.goal).not.toBe(3);
});
