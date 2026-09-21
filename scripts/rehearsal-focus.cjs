// Live demonstrations may pause on focus loss; strict acceptance still stops.
class RehearsalFocus {
 paused=false;identity='';stableAt=null;
 update(o,epoch,now){
  if(!o||now-o.timestamp>250||o.timestamp>now+50){this.stableAt=null;return 'wait';}
  const identity=[o.processId,o.session,o.matchId].join(':');
  if(this.paused&&(identity!==this.identity||o.epoch!==epoch||o.executor?.reason==='manual_takeover'))return 'stop';
  if(!o.foreground){if(!this.paused){this.paused=true;this.identity=identity;}this.stableAt=null;return 'pause';}
  if(!this.paused)return 'continue';
  if(o.mode!=='manual'||o.diagnostics.heldInputs!==0){this.stableAt=null;return 'wait';}
  if(!['focus_lost','lease_expired'].includes(o.executor?.reason))return 'stop';
  this.stableAt??=now;if(now-this.stableAt<1000)return 'wait';
  this.paused=false;this.stableAt=null;return 'resume';
 }
}
function captureState(o,pid,now){
 if(!o||o.processId!==pid||now-o.timestamp>1500||o.timestamp>now+50)return 'unavailable';
 return o.foreground&&o.mode==='auto'?'playing':'paused';
}
module.exports={RehearsalFocus,captureState};
