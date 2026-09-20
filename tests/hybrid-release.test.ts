import {it,expect} from 'vitest';
import {createRequire} from 'node:module';
const {verifyManualRelease}=createRequire(import.meta.url)('../scripts/verify-manual-release.cjs');
function clock(){let at=1000;return {now:()=>at,wait:async(ms:number)=>{at+=ms;}};}
const state=(at:number,extra={})=>({timestamp:at,processId:123,epoch:999,mode:'manual',diagnostics:{heldInputs:0},...extra});
it('waits through missing and pre-acknowledgement frames for fresh manual release',async()=>{
 const c=clock();let calls=0;
 const r=await verifyManualRelease({pid:123,epoch:999,requestedAt:1000,...c,observe:async()=>{if(++calls===1)throw Error('temporary read gap');return calls===2?state(c.now(),{mode:'auto',epoch:2}):state(c.now());}});
 expect(r.confirmed).toBe(true);expect(r.attempts).toBe(3);
});
it('cannot pass on stale, earlier, wrong-process, wrong-epoch or held-input evidence',async()=>{
 for(const s of [state(900),state(0),state(2000),state(1000,{processId:456}),state(1000,{epoch:2}),state(1000,{diagnostics:{heldInputs:1}})]){
  const c=clock(),r=await verifyManualRelease({pid:123,epoch:999,requestedAt:1000,timeoutMs:50,...c,observe:async()=>s});
  expect(r.confirmed).toBe(false);
 }
});
