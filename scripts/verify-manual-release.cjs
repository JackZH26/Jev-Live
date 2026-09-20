// Poll authenticated fresh observations; do not relax the bridge's age/identity
// checks or turn a later disk snapshot into a retroactive passing receipt.
async function verifyManualRelease({observe,pid,epoch,requestedAt,timeoutMs=3000,now=Date.now,wait=ms=>new Promise(r=>setTimeout(r,ms))}){
 const deadline=now()+timeoutMs;let attempts=0,last;
 while(now()<=deadline){
  attempts++;let o;try{o=await observe(pid);}catch{}
  if(o)last={at:o.timestamp,epoch:o.epoch,mode:o.mode,held:o.diagnostics.heldInputs};
  if(o&&o.timestamp>=requestedAt&&now()-o.timestamp<=250&&o.timestamp<=now()+50
    &&o.processId===pid&&o.epoch===epoch&&o.mode==='manual'&&o.diagnostics.heldInputs===0)
   return {confirmed:true,attempts,observation:last};
  if(now()>=deadline)break;
  await wait(Math.min(50,deadline-now()));
 }
 return {confirmed:false,attempts,observation:last};
}
module.exports={verifyManualRelease};
