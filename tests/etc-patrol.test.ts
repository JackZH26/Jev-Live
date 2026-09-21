import {describe,it,expect} from 'vitest';
import {EtcPolicy} from '../electron/etc-policy';
import {EtcTactics} from '../electron/etc-tactics';
import type {EtcAction,EtcObservation} from '../shared/etc';

const at=100000;
const action=(kind:EtcAction['kind'],id=kind as string,distance=0):EtcAction=>({id,kind,distance,safe:true});
function safeRoom():EtcObservation{return {
  version:3,appId:'5272970',session:'session',matchId:'match',timestamp:at,frame:1,processId:123,
  phase:'playing',mode:'auto',epoch:1,ack:1,foreground:true,map:'match',
  self:{position:[0,0,90],health:100,maxHealth:100,magazine:30,magazineCapacity:30,reserve:180,
    weapon:'AR01',protected:false,traveling:false,healing:false,room:1,roomType:5,danger:false,evacuationSeconds:-1,kills:0},
  enemies:[],actions:[action('wait'),action('scan'),{...action('portal','exit',500),destination:2,destinationRisk:0}],result:null,
  diagnostics:{heldInputs:0,shots:0,stuck:false,observationMs:1,lastAction:'wait'},
  executor:{kind:'shared-bot-v1',objective:'wait',status:'running',reason:'accepted',failures:0,pathStatus:0},
};}
function tick(p:EtcPolicy,o:EtcObservation,elapsed:number,advice='wait'){
  o.timestamp=at+elapsed;o.frame++;
  return p.choose(o,o.timestamp,false,true,advice)?.id;
}

describe('safe-room resupply and continuous cover patrol',()=>{
  it.each(['wait','scan','exit','cover'])('checks unopened chests despite a stocked loadout and %s advice',advice=>{
    const p=new EtcPolicy(),o=safeRoom();o.actions.push(action('loot','chest',1800),action('cover','cover',500));
    expect(tick(p,o,0,advice)).toBe('chest');
  });
  it('finishes each chest once and clears usable drops before the next chest',()=>{
    const p=new EtcPolicy(),o=safeRoom();o.actions.push(action('loot','chest_a',900),action('loot','chest_b',2000));
    expect(tick(p,o,0)).toBe('chest_a');
    o.executor={...o.executor!,objective:'chest_a',status:'succeeded',reason:'chest_opened'};
    o.actions.push(action('pickup','recovery',100),action('pickup','grenade',150),action('pickup','ammo',200));
    for(const [index,id] of ['recovery','grenade','ammo','chest_b'].entries()){
      expect(tick(p,o,(index+1)*50,'chest_a')).toBe(id);
      o.executor={...o.executor!,objective:id,status:'succeeded'};
    }
    expect(tick(p,o,300,'chest_b')).toBe('scan'); // Completed offers may linger in the bridge.
  });
  it('does not omit a far offered chest or cross the room for a remote loose item first',()=>{
    const p=new EtcPolicy(),o=safeRoom();o.actions.push(action('loot','chest',4200),action('pickup','distant',7000));
    expect(tick(p,o,0)).toBe('chest');
  });
  it('keeps native cover patrol running beyond the old 18-second hold/3-second scan cycle',()=>{
    const p=new EtcPolicy(),o=safeRoom(),t=new EtcTactics();
    for(let elapsed=0;elapsed<=60000;elapsed+=250){
      expect(tick(p,o,elapsed)).toBe('scan');
      o.executor={...o.executor!,objective:'scan',status:'running'};
      t.observe(o,1,o.timestamp);
    }
    expect(t.options(o).map(a=>a.kind)).toContain('scan');
    expect(t.options(o).map(a=>a.kind)).not.toContain('wait');
    expect(t.accept('wait',o,o,1,o.timestamp)).toBe(false);
  });
  it('translates tactical wait to patrol outside verified terrain too, using actual safe offers',()=>{
    const p=new EtcPolicy(),o=safeRoom();delete o.self.roomType;
    expect(tick(p,o,0)).toBe('scan');
    o.actions.find(a=>a.kind==='scan')!.safe=false;
    expect(tick(p,o,50)).toBe('exit');
  });
  it('interrupts optional departure for new supplies, but preserves an airborne crossing',()=>{
    const p=new EtcPolicy(),o=safeRoom();delete o.self.roomType;
    expect(tick(p,o,0,'exit')).toBe('exit');
    o.executor={...o.executor!,objective:'exit',status:'running'};o.actions.push(action('loot','chest',900));
    o.self.grounded=false;expect(tick(p,o,50,'exit')).toBe('exit');
    o.self.grounded=true;expect(tick(p,o,100,'exit')).toBe('chest');
  });
  it('does not abandon a progressing chest approach for each new nearby offer',()=>{
    const p=new EtcPolicy(),o=safeRoom();o.actions.push(action('loot','chest',1500));expect(tick(p,o,0)).toBe('chest');
    o.executor={...o.executor!,objective:'chest',status:'running'};o.actions.push(action('loot','other',1400));
    o.self.position[0]=200;o.actions.find(a=>a.id==='chest')!.distance=1300;
    expect(tick(p,o,1000,'other')).toBe('chest');
  });
  it('leaves a stationary supply target in 6.5 seconds and excludes it for 15 seconds',()=>{
    const p=new EtcPolicy(),o=safeRoom();o.actions.push(action('loot','stuck',900));expect(tick(p,o,0)).toBe('stuck');
    o.executor={...o.executor!,objective:'stuck',status:'running'};
    expect(tick(p,o,50)).toBe('stuck');
    expect(tick(p,o,6501,'stuck')).toBe('scan');
    o.executor={...o.executor,objective:'scan',status:'running'};
    expect(tick(p,o,21500,'stuck')).toBe('scan');
    expect(tick(p,o,21501,'stuck')).toBe('stuck');
  });
  it('uses another chest immediately after a blocked target and aligns the cloud cooldown',()=>{
    const p=new EtcPolicy(),o=safeRoom(),t=new EtcTactics();o.actions.push(action('loot','blocked',100),action('loot','other',900));
    expect(tick(p,o,0)).toBe('blocked');
    o.executor={...o.executor!,objective:'blocked',status:'blocked'};expect(tick(p,o,50)).toBe('other');t.observe(o,1,o.timestamp);
    o.executor={...o.executor,objective:'scan',status:'running'};
    o.timestamp=at+10000;t.observe(o,1,o.timestamp);expect(t.options(o).some(a=>a.id==='blocked')).toBe(false);
    o.timestamp=at+15050;t.observe(o,1,o.timestamp);expect(t.options(o).some(a=>a.id==='blocked')).toBe(true);
  });
  it('allows a moving detour but still bounds routes oscillating without approach progress',()=>{
    const p=new EtcPolicy(),o=safeRoom();o.actions.push(action('loot','chest',1800));expect(tick(p,o,0)).toBe('chest');
    o.executor={...o.executor!,objective:'chest',status:'running'};
    for(let i=1;i<=20;i++){
      o.self.position[1]=i%2?150:0;
      expect(tick(p,o,i*1000)).toBe('chest');
    }
    o.self.position[1]=150;expect(tick(p,o,20001)).toBe('scan');
  });
  it('resets the approach budget when distance genuinely improves',()=>{
    const p=new EtcPolicy(),o=safeRoom();o.actions.push(action('loot','chest',9000));expect(tick(p,o,0)).toBe('chest');
    o.executor={...o.executor!,objective:'chest',status:'running'};
    for(let i=1;i<=6;i++){
      o.actions.find(a=>a.id==='chest')!.distance-=200;
      expect(tick(p,o,i*5000)).toBe('chest');
    }
  });
  it('preserves safe healing and reloading, then returns to supplies',()=>{
    const p=new EtcPolicy(),o=safeRoom();o.actions.push(action('loot','chest',900));
    o.self.healing=true;expect(tick(p,o,0)).toBe('wait');
    o.self.healing=false;o.self.reloading=true;expect(tick(p,o,50)).toBe('wait');
    o.self.reloading=false;expect(tick(p,o,100)).toBe('chest');
  });
  it('interrupts supplies immediately for a visible enemy, incoming damage and evacuation',()=>{
    const p=new EtcPolicy(),o=safeRoom();o.actions.push(action('loot','chest',900),action('cover','cover',500));
    expect(tick(p,o,0)).toBe('chest');o.executor={...o.executor!,objective:'chest',status:'running'};
    o.enemies=[{id:'enemy',position:[1000,0,90],velocity:[0,0,0],distance:1000}];o.actions.push(action('engage','enemy',1000));
    expect(tick(p,o,50,'chest')).toBe('enemy');
    o.self.health=90;expect(tick(p,o,100,'chest')).toBe('cover');
    o.enemies=[];o.self.danger=true;expect(tick(p,o,150,'chest')).toBe('exit');
  });
  it.each(['foreground','stale','paused','traveling'] as const)('does not use anti-idle to bypass %s',reason=>{
    const p=new EtcPolicy(),o=safeRoom();o.actions.push(action('loot','chest',900));
    if(reason==='foreground')o.foreground=false;
    if(reason==='paused')o.phase='paused';
    if(reason==='traveling')o.self.traveling=true;
    expect(p.choose(o,at+(reason==='stale'?251:0),false,true,'scan')?.kind).toBe('wait');
  });
});
