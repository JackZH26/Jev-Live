import { it,expect } from 'vitest';
import { createRequire } from 'node:module';
const {evaluate}=createRequire(import.meta.url)('../scripts/hybrid-streak.cjs');
const win=(at:number,extra={})=>({file:String(at),r:{startedAt:String(at),sha256:'native',runtimeHashes:{policy:'one'},graphicsHash:'gfx',harnessHash:'runner',provider:'jev',stopReason:'official_result',summary:{matches:1,wins:1,lastPlacement:1},officialResult:{won:true,placement:1},cloudStats:{jevResponses:1},manualRelease:true,...extra}});
it('requires two consecutive authoritative firsts on identical versions',()=>{
 expect(evaluate([win(1),win(2)]).passed).toBe(true);
 expect(evaluate([win(1),win(2,{sha256:'new'})]).streak).toBe(1);
 expect(evaluate([win(1),win(2,{runtimeHashes:{policy:'two'}})]).streak).toBe(1);
 expect(evaluate([win(1),win(2,{focusHelperHash:'new'})]).streak).toBe(1);
 expect(evaluate([win(1),win(2,{releaseHelperHash:'new'})]).streak).toBe(1);
});
it('losses and incomplete trials reset the streak instead of being skipped',()=>{
 for(const change of [{stopReason:'time_budget'},{manualRelease:false},{officialResult:null},{cloudStats:{jevResponses:0}},{summary:{matches:1,wins:0,lastPlacement:2}}]){
  expect(evaluate([win(1),win(2,change),win(3)]).streak).toBe(1);
 }
});
