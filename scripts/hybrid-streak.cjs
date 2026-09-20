// Recompute from EVERY chronological receipt; never cherry-pick two wins.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
function version(r){return JSON.stringify([r.sha256,r.runtimeHashes,r.graphicsHash,r.harnessHash,r.focusHelperHash??null,r.releaseHelperHash??null,r.provider]);}
function evaluate(receipts){
 let streak=0,last='',best=0;const rows=[];
 for(const {file,r} of [...receipts].sort((a,b)=>a.r.startedAt.localeCompare(b.r.startedAt))){
  const key=version(r),changed=key!==last;if(changed)streak=0;
  const complete=r.stopReason==='official_result'&&r.summary?.matches===1&&r.manualRelease===true;
  const first=complete&&r.provider==='jev'&&r.cloudStats?.jevResponses>0&&r.summary.wins===1
   &&r.summary.lastPlacement===1&&r.officialResult?.won===true&&r.officialResult.placement===1;
  streak=first?streak+1:0;best=Math.max(best,streak);last=key;
  rows.push({file,candidate:r.candidate,version:crypto.createHash('sha256').update(key).digest('hex'),changed,
   placement:r.summary?.lastPlacement??null,complete,first,streak,stopReason:r.stopReason??r.error});
 }
 return {target:2,streak,best,passed:streak>=2,rows};
}
module.exports={evaluate};
if(require.main===module){
 const root=path.resolve(__dirname,'../test-results');
 const receipts=fs.readdirSync(root).filter(n=>n.startsWith('hybrid-smoke-')).flatMap(n=>{
  const file=path.join(root,n,'receipt.json');if(!fs.existsSync(file))return [];
  return [{file:path.relative(root,file),r:JSON.parse(fs.readFileSync(file,'utf8'))}];
 });
 const ledger=evaluate(receipts);fs.writeFileSync(path.join(root,'hybrid-streak.json'),JSON.stringify(ledger,null,2));
 console.log(JSON.stringify({...ledger,rows:ledger.rows.slice(-10)},null,2));
}
