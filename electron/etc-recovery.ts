import type { EtcObservation } from '../shared/etc';

/** Rearm only a confirmed lease stop in the same authorized, focused match. */
export class EtcLeaseRecovery {
  private identity='';private started=0;private stable=0;private frame=-1;private lastAt=0;
  private resumed:number[]=[];
  reset(){this.identity='';this.started=0;this.stable=0;this.frame=-1;this.lastAt=0;this.resumed=[];}
  poll(o:EtcObservation,epoch:number,now:number):'active'|'wait'|'resume'|'stop'{
    const identity=JSON.stringify([o.session,o.matchId,o.processId]);
    if(o.epoch!==epoch||!o.foreground||o.phase!=='playing'||now-o.timestamp>250||o.timestamp>now+50)return 'stop';
    if(o.mode==='auto'){
      if(this.identity!==identity)this.resumed=[];
      this.identity=identity;this.started=0;this.stable=0;this.frame=o.frame;this.lastAt=now;
      return 'active';
    }
    if(identity!==this.identity||o.executor?.status!=='released'||o.executor.reason!=='lease_expired'||o.diagnostics.heldInputs!==0)return 'stop';
    if(!this.started)this.started=now;
    this.resumed=this.resumed.filter(at=>now-at<60000);
    if(now-this.started>5000||this.resumed.length>=8)return 'stop';
    // Duplicate frames and another hitch cannot certify a stable connection.
    if(o.frame===this.frame)return 'wait';
    if(!this.stable||now-this.lastAt>150)this.stable=now;
    this.frame=o.frame;this.lastAt=now;
    if(now-this.stable<500)return 'wait';
    this.resumed.push(now);this.started=0;this.stable=0;
    return 'resume';
  }
}
