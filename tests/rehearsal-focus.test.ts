import {it,expect} from 'vitest';
import {createRequire} from 'node:module';
const {RehearsalFocus,captureState}=createRequire(import.meta.url)('../scripts/rehearsal-focus.cjs');
const frame=(at:number,extra={})=>({timestamp:at,processId:42,session:'s',matchId:'m',epoch:2,mode:'manual',foreground:false,diagnostics:{heldInputs:0},executor:{reason:'focus_lost'},...extra});
it('pauses without control and resumes only after released inputs and stable foreground',()=>{
 const g=new RehearsalFocus();expect(g.update(frame(1000),2,1000)).toBe('pause');
 expect(g.update(frame(2000,{foreground:true,diagnostics:{heldInputs:1}}),2,2000)).toBe('wait');
 expect(g.update(frame(2100,{foreground:true}),2,2100)).toBe('wait');
 expect(g.update(frame(3050),2,3050)).toBe('pause');
 expect(g.update(frame(3100,{foreground:true}),2,3100)).toBe('wait');
 expect(g.update(frame(4101,{foreground:true}),2,4101)).toBe('resume');
});
it('cannot resume a manual takeover, changed session, match or epoch',()=>{
 for(const extra of [{executor:{reason:'manual_takeover'}},{epoch:3},{session:'other'},{matchId:'new'},{processId:43}]){const g=new RehearsalFocus();g.update(frame(1000),2,1000);expect(g.update(frame(3000,{foreground:true,...extra}),2,3000)).toBe('stop');}
});
it('rejects stale/wrong-process capture and labels fresh loss of control as paused',()=>{
 expect(captureState(frame(1000),42,1100)).toBe('paused');
 expect(captureState(frame(1000,{mode:'auto',foreground:true}),42,1100)).toBe('playing');
 expect(captureState(frame(1000),43,1100)).toBe('unavailable');
 expect(captureState(frame(1000),42,5000)).toBe('unavailable');
 const g=new RehearsalFocus();g.update(frame(1000),2,1000);expect(g.update(frame(1000,{foreground:true}),2,5000)).toBe('wait');
});
