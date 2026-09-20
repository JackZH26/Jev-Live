import { describe,it,expect } from 'vitest';
import { EtcTactics } from '../electron/etc-tactics';
import { EtcPolicy } from '../electron/etc-policy';
import { etcObservationSchema,type EtcObservation } from '../shared/etc';

const at=100_000;
function state():EtcObservation{return {
  version:3,appId:'5272970',session:'session',matchId:'match',timestamp:at,frame:20,processId:123,
  phase:'playing',mode:'auto',epoch:1,ack:1,foreground:true,map:'match',
  self:{position:[0,0,90],health:100,maxHealth:100,magazine:20,reserve:40,weapon:'AR01',protected:false,traveling:false,healing:false,room:1,danger:false,evacuationSeconds:-1,kills:0},
  enemies:[{id:'enemy',position:[1000,0,90],velocity:[0,0,0],distance:1000}],
  actions:[{id:'wait',kind:'wait',distance:0,safe:true},{id:'scan',kind:'scan',distance:0,safe:true},{id:'engage',kind:'engage',distance:1000,safe:true},{id:'portal',kind:'portal',distance:500,safe:true,destination:2},{id:'cover',kind:'cover',distance:100,safe:true}],result:null,
  diagnostics:{heldInputs:0,shots:0,stuck:false,observationMs:1,lastAction:'engage'},
  executor:{kind:'shared-bot-v1',objective:'engage',status:'running',reason:'accepted',failures:0,pathStatus:3},
};}

describe('hybrid tactical contract',()=>{
  it('accepts an objective and keeps it across fresh renewals until its soft TTL',()=>{
    const t=new EtcTactics(),o=state();t.observe(o,1,at);
    expect(t.accept('portal',o,o,1,at)).toBe(true);
    o.timestamp=at+3900;o.frame++;t.observe(o,1,at+3900);expect(t.advice(o,at+3900)).toBe('portal');
    expect(t.advice(o,at+4001)).toBeUndefined();
  });
  it.each(['epoch','match','session','room','age','foreground','phase','removed','unsafe'])(`rejects a late cloud result after %s changes`,reason=>{
    const t=new EtcTactics(),source=state(),current=structuredClone(source);t.observe(source,1,at);
    let epoch=1,now=at;
    if(reason==='epoch'){epoch=2;t.observe(current,epoch,at);}
    if(reason==='match')current.matchId='next';
    if(reason==='session')current.session='next';
    if(reason==='room')current.self.room=2;
    if(reason==='age'){now+=2201;current.timestamp=now;}
    if(reason==='foreground')current.foreground=false;
    if(reason==='phase')current.phase='dead';
    if(reason==='removed')current.actions=current.actions.filter(a=>a.id!=='portal');
    if(reason==='unsafe')current.actions.find(a=>a.id==='portal')!.safe=false;
    expect(t.accept('portal',source,current,epoch,now)).toBe(false);
  });
  it('drops completed objectives and cools down the exact failed target',()=>{
    const t=new EtcTactics(),o=state();t.observe(o,1,at);t.accept('portal',o,o,1,at);
    o.executor={...o.executor!,objective:'portal',status:'blocked',reason:'stationary'};
    t.observe(o,1,at+50);expect(t.advice(o,at+50)).toBeUndefined();
    expect(t.options(o).some(a=>a.id==='portal')).toBe(false);
    o.executor={...o.executor!,objective:'scan',status:'running'};
    t.observe(o,1,at+5100);expect(t.options(o).some(a=>a.id==='portal')).toBe(true);
    o.timestamp=at+5100;t.accept('portal',o,o,1,at+5100);
    o.executor={...o.executor,objective:'portal',status:'succeeded'};t.observe(o,1,at+5150);
    expect(t.advice(o,at+5150)).toBeUndefined();
  });
  it('old target feedback does not clear a new objective',()=>{
    const t=new EtcTactics(),o=state();t.observe(o,1,at);t.accept('portal',o,o,1,at);
    o.executor={...o.executor!,objective:'engage',status:'blocked'};t.observe(o,1,at+50);
    expect(t.advice(o,at+50)).toBe('portal');
  });
  it('events trigger reconsideration without making a cloud request every frame',()=>{
    const t=new EtcTactics(),o=state();t.observe(o,1,at);
    expect(t.shouldRequest(o,at,2500)).toBe(true);t.accept('portal',o,o,1,at);
    expect(t.shouldRequest(o,at+799,2500)).toBe(false);
    expect(t.shouldRequest(o,at+900,2500)).toBe(false);
    o.self.danger=true;expect(t.shouldRequest(o,at+900,2500)).toBe(true);
    expect(t.shouldRequest(o,at+950,2500)).toBe(false);
  });
  it('manual takeover resets the objective, history and failed routes',()=>{
    const t=new EtcTactics(),o=state();t.observe(o,1,at);t.accept('portal',o,o,1,at);t.reset();
    expect(t.advice(o,at)).toBeUndefined();expect(t.context().recent).toEqual([]);
    expect(t.accept('portal',o,o,1,at)).toBe(false);
  });
  it('does not offer optional travel into active collapse while a safe exit is available',()=>{
    const t=new EtcTactics(),o=state();o.actions.find(a=>a.id==='portal')!.destinationRisk=0;
    o.actions.push({id:'red_door',kind:'portal',safe:true,distance:10,destinationRisk:2,destination:3});t.observe(o,1,at);
    expect(t.options(o).some(a=>a.id==='red_door')).toBe(false);
    expect(new EtcPolicy().choose(o,at,false,true,'red_door')?.id).not.toBe('red_door');
    o.self.danger=true;expect(t.options(o).some(a=>a.id==='red_door')).toBe(true);
    o.self.danger=false;o.actions.find(a=>a.id==='portal')!.safe=false;
    expect(t.options(o).some(a=>a.id==='red_door')).toBe(true);
  });
  it('defends a stocked safe terrain room and restores relocation immediately on danger or damage',()=>{
    const t=new EtcTactics(),p=new EtcPolicy(),o=state();o.self.roomType=5;o.enemies=[];t.observe(o,1,at);
    expect(t.options(o).some(a=>a.kind==='portal')).toBe(false);expect(t.options(o).some(a=>a.kind==='wait')).toBe(true);
    expect(p.choose(o,at,false,true,'portal')?.kind).toBe('wait');
    o.self.danger=true;expect(t.options(o).some(a=>a.kind==='portal')).toBe(true);expect(p.choose(o,at,false,true,'wait')?.kind).toBe('portal');
    o.self.danger=false;o.self.health=88;o.timestamp=at+50;t.observe(o,1,o.timestamp);
    expect(t.options(o).some(a=>a.kind==='portal')).toBe(true);expect(p.choose(o,o.timestamp,false,true,'wait')?.kind).not.toBe('wait');
  });
  it('stops optional transit as soon as the current room becomes a verified defensive position',()=>{
    const p=new EtcPolicy(),o=state();o.enemies=[];o.self.roomType=undefined;
    expect(p.choose(o,at,false,true,'portal')?.kind).toBe('portal');
    o.executor={...o.executor!,objective:'portal',status:'running'};o.self.roomType=5;o.timestamp=at+50;
    expect(p.choose(o,o.timestamp,false,true,'portal')?.kind).toBe('wait');
  });
  it('expires unproductive scouting without stopping the movement heartbeat',()=>{
    const t=new EtcTactics(),o=state();o.enemies=[];o.actions=o.actions.filter(a=>a.kind!=='engage');
    o.executor={...o.executor!,objective:'scan'};t.observe(o,1,at);expect(t.accept('scan',o,o,1,at)).toBe(true);
    for(let i=1;i<=48;i++){o.timestamp=at+i*250;o.frame++;o.self.position[0]+=25;t.observe(o,1,o.timestamp);}
    expect(t.context().progress.unproductiveScoutSeconds).toBe(12);
    expect(t.context().progress.sampledRoomDistanceM).toBe(12);
    expect(t.options(o).map(a=>a.id)).toContain('portal');
    expect(t.options(o).map(a=>a.id)).not.toContain('scan');
    expect(t.accept('scan',o,o,1,o.timestamp)).toBe(false);
    expect(new EtcPolicy().choose(o,o.timestamp,false,true,t.advice(o,o.timestamp))?.id).toBe('portal');
    o.actions.find(a=>a.id==='portal')!.safe=false;
    expect(t.options(o).map(a=>a.id)).toContain('scan'); // Never remove the only useful fallback.
  });
  it('new supplies and a new room renew reconnaissance, repeated sightings do not',()=>{
    const t=new EtcTactics(),o=state();o.enemies=[];o.actions=o.actions.filter(a=>a.kind!=='engage');
    o.executor={...o.executor!,objective:'scan'};t.observe(o,1,at);
    for(let i=1;i<=48;i++){o.timestamp=at+i*250;t.observe(o,1,o.timestamp);}
    o.actions.push({id:'chest',kind:'loot',distance:500,safe:true});t.observe(o,1,o.timestamp+50);
    expect(t.context().progress.unproductiveScoutSeconds).toBe(0);
    t.observe(o,1,o.timestamp+100);expect(t.context().progress.unproductiveScoutSeconds).toBe(.05);
    o.self.room=2;t.observe(o,1,o.timestamp+150);
    expect(t.context().progress.unproductiveScoutSeconds).toBe(0);
    expect(t.context().progress.sampledRoomDistanceM).toBe(0);
  });
  it('own health loss triggers a bounded tactical refresh without inventing an attacker',()=>{
    const t=new EtcTactics(),o=state();t.observe(o,1,at);t.shouldRequest(o,at,2500);t.accept('portal',o,o,1,at);
    o.timestamp=at+900;o.self.health=90;t.observe(o,1,o.timestamp);
    expect(t.shouldRequest(o,o.timestamp,2500)).toBe(true);
    expect(t.context().progress.damageSecondsAgo).toBe(0);
    o.timestamp+=50;o.self.health=80;t.observe(o,1,o.timestamp);
    expect(t.shouldRequest(o,o.timestamp,2500)).toBe(false);
    t.reset();expect(t.context().progress.damageSecondsAgo).toBeNull();
  });
});

describe('hybrid survival arbitration',()=>{
  const choose=(o:EtcObservation,id='portal')=>new EtcPolicy().choose(o,at,false,true,id)?.id;
  it('lets a healthy fighter follow Jev retreat; legacy games retain the bounded hint',()=>{
    const o=state();expect(choose(o)).toBe('portal');delete o.executor;expect(choose(o)).toBe('engage');
  });
  it('takes urgent cover instead of obeying a cloud attack',()=>{
    const o=state();o.self.health=20;expect(choose(o,'engage')).toBe('cover');
  });
  it('evacuates danger and rejects protected firing despite cloud advice',()=>{
    const o=state();o.self.danger=true;expect(choose(o,'engage')).toBe('portal');
    o.self.danger=false;o.self.protected=true;expect(choose(o,'engage')).not.toBe('engage');
  });
  it('reloads an empty magazine instead of following a tactical objective',()=>{
    const o=state();o.self.magazine=0;o.actions.push({id:'reload',kind:'reload',distance:0,safe:true});
    expect(choose(o)).toBe('cover');o.enemies=[];expect(choose(o)).toBe('reload');
  });
  it('does not blacklist the new target because an older target failed',()=>{
    const p=new EtcPolicy(),o=state();expect(p.choose(o,at,false,true,'portal')?.id).toBe('portal');
    o.executor={...o.executor!,objective:'engage',status:'blocked'};o.diagnostics.stuck=true;
    expect(p.choose(o,at+50,false,true,'portal')?.id).toBe('portal');
  });
  it('capability negotiation accepts old frames and validates advertised executor feedback',()=>{
    const o=state();expect(etcObservationSchema.safeParse(o).success).toBe(true);
    expect(etcObservationSchema.safeParse({...o,executor:{...o.executor,pathStatus:99}}).success).toBe(false);
    delete o.executor;expect(etcObservationSchema.safeParse(o).success).toBe(true);
  });
});
