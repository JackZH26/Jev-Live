import { it,expect } from 'vitest';
import { EtcLeaseRecovery,EtcFocusRecovery } from '../electron/etc-recovery';
import type { EtcObservation } from '../shared/etc';

function observed():EtcObservation{return {session:'s',matchId:'m',processId:1,epoch:1,frame:1,timestamp:1000,phase:'playing',mode:'auto',foreground:true,diagnostics:{heldInputs:0},executor:{status:'running',reason:'accepted'}} as EtcObservation;}
function leaseStop(){const r=new EtcLeaseRecovery(),o=observed();expect(r.poll(o,1,1000)).toBe('active');o.mode='manual';o.executor={...o.executor!,status:'released',reason:'lease_expired'};return {r,o};}
it('waits for fresh distinct frames before rearming an expired lease',()=>{
  const {r,o}=leaseStop();
  for(let i=1;i<=11;i++){o.frame++;o.timestamp=1000+i*50;expect(r.poll(o,1,o.timestamp)).toBe(i===11?'resume':'wait');}
});
it.each(['manual_takeover','focus_lost','session_expired','unsupported_world'])('never rearms %s',reason=>{
  const {r,o}=leaseStop();o.executor!.reason=reason;expect(r.poll(o,1,1000)).toBe('stop');
});
it.each(['match','session','pid','epoch','focus','held','phase','stale'])('rejects a changed %s',change=>{
  const {r,o}=leaseStop();
  if(change==='match')o.matchId='other';if(change==='session')o.session='other';if(change==='pid')o.processId=2;
  if(change==='epoch')o.epoch=2;if(change==='focus')o.foreground=false;if(change==='held')o.diagnostics.heldInputs=1;
  if(change==='phase')o.phase='dead';if(change==='stale')o.timestamp=0;
  expect(r.poll(o,1,1000)).toBe('stop');
});
it('duplicates and renewed stalls cannot count as stable frames',()=>{
  const {r,o}=leaseStop();o.frame++;o.timestamp=1050;expect(r.poll(o,1,1050)).toBe('wait');
  expect(r.poll(o,1,1250)).toBe('wait');o.timestamp=1550;o.frame++;expect(r.poll(o,1,1550)).toBe('wait');
  o.timestamp=6100;o.frame++;expect(r.poll(o,1,6100)).toBe('stop');
});
it('limits recovery storms and clears ownership on explicit mode changes',()=>{
  const {r,o}=leaseStop();let at=1000;
  for(let attempt=0;attempt<8;attempt++){
    for(let i=0;i<=10;i++){at+=50;o.timestamp=at;o.frame++;expect(r.poll(o,1,at)).toBe(i===10?'resume':'wait');}
    o.mode='auto';r.poll(o,1,at);o.mode='manual';
  }
  o.timestamp=at+50;o.frame++;expect(r.poll(o,1,o.timestamp)).toBe('stop');
  r.reset();expect(r.poll(o,1,o.timestamp)).toBe('stop');
});
it('accepts steady 5 Hz observations while requiring the same 250 ms freshness',()=>{
  const {r,o}=leaseStop();
  for(let i=1;i<=4;i++){o.frame++;o.timestamp=1000+i*200;expect(r.poll(o,1,o.timestamp)).toBe(i===4?'resume':'wait');}
});
it('a frame crossing the freshness deadline cannot rearm or contribute stability',()=>{
  const {r,o}=leaseStop();o.timestamp=1050;o.frame++;expect(r.poll(o,1,1050)).toBe('wait');
  expect(r.poll(o,1,1301)).toBe('wait');
  o.timestamp=1350;o.frame++;expect(r.poll(o,1,1350)).toBe('wait');
});

it('pauses focus without rearming and resumes only after fresh stable foreground observations',()=>{
 const r=new EtcFocusRecovery(),o=observed();o.foreground=false;expect(r.poll(o,1,1000)).toBe('wait');
 o.mode='manual';o.executor={...o.executor!,status:'released',reason:'focus_lost'};
 for(let i=1;i<=8;i++){o.foreground=true;o.timestamp=1000+i*125;o.frame++;expect(r.poll(o,1,o.timestamp)).toBe(i===7?'resume':i===8?'active':'wait');}
});
it('can return from focus pause after an official result in the same match',()=>{
 const r=new EtcFocusRecovery(),o=observed();o.foreground=false;r.poll(o,1,1000);
 o.foreground=true;o.phase='ended';o.result={placement:2,won:false};o.mode='manual';o.executor={...o.executor!,status:'released',reason:'lease_expired'};
 for(let i=1;i<=4;i++){o.timestamp=2000+i*250;o.frame++;expect(r.poll(o,1,o.timestamp)).toBe(i===4?'resume':'wait');}
});
it.each(['match','session','pid','epoch','manual','paused'] as const)('focus recovery rejects changed %s',change=>{
 const r=new EtcFocusRecovery(),o=observed();o.foreground=false;r.poll(o,1,1000);o.foreground=true;o.mode='manual';o.executor={...o.executor!,status:'released',reason:'focus_lost'};
 if(change==='match')o.matchId='other';if(change==='session')o.session='other';if(change==='pid')o.processId=2;
 if(change==='epoch')o.epoch=2;if(change==='manual')o.executor.reason='manual_takeover';if(change==='paused')o.phase='paused';
 expect(r.poll(o,1,1000)).toBe('stop');
});
it('does not count stale, duplicate or background frames toward focus recovery',()=>{
 const r=new EtcFocusRecovery(),o=observed();o.foreground=false;r.poll(o,1,1000);o.foreground=true;o.mode='manual';o.executor={...o.executor!,status:'released',reason:'focus_lost'};
 o.timestamp=2000;o.frame++;expect(r.poll(o,1,2000)).toBe('wait');expect(r.poll(o,1,2750)).toBe('wait');
 o.timestamp=2800;o.frame++;expect(r.poll(o,1,2800)).toBe('wait');
 o.foreground=false;o.timestamp=2900;o.frame++;expect(r.poll(o,1,2900)).toBe('wait');
 r.reset();expect(r.pending).toBe(false);
});
