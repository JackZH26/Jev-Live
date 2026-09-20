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
    if(reason==='age')now+=1501;
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
