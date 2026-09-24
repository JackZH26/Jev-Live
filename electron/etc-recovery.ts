import type { EtcObservation } from '../shared/etc';

/** Keep the user's auto intent during focus loss; never steal focus or resume a takeover. */
export class EtcFocusRecovery {
  private identity='';private epoch=0;private stableAt=0;private frame=-1;private lastAt=0;
  private requestedFrom?:{epoch:number;ack:number};
  get pending(){return !!this.identity;}
  reset(){this.identity='';this.epoch=0;this.stableAt=0;this.frame=-1;this.lastAt=0;this.requestedFrom=undefined;}
  /** Explicit Auto requested in the background: the native auto command cannot be sent yet. */
  waitForForeground(o:EtcObservation,epoch:number){
    this.reset();this.identity=JSON.stringify([o.session,o.processId,o.matchId]);this.epoch=epoch;
    this.requestedFrom={epoch:o.epoch,ack:o.ack};
  }
  poll(o:EtcObservation,epoch:number,now:number):'active'|'wait'|'resume'|'stop'{
    const identity=JSON.stringify([o.session,o.processId,o.matchId]);
    if(['paused','unsupported'].includes(o.phase))return 'stop';
    if(this.pending&&(this.identity!==identity||this.epoch!==epoch))return 'stop';
    if(this.requestedFrom){
      // Only the exact state preceding this explicit request is authorized.
      // A subsequent manual command changes epoch/ack and cancels the request.
      if(o.epoch!==this.requestedFrom.epoch||o.ack!==this.requestedFrom.ack)return 'stop';
    }else if(o.epoch!==epoch||o.executor?.reason==='manual_takeover')return 'stop';
    if(now-o.timestamp>250||o.timestamp>now+50){this.stableAt=0;return 'wait';}
    if(!o.foreground){
      if(!this.pending){this.identity=identity;this.epoch=epoch;}
      this.stableAt=0;this.frame=o.frame;this.lastAt=now;return 'wait';
    }
    if(!this.pending)return 'active';
    if(o.mode!=='manual'||o.diagnostics.heldInputs!==0){this.stableAt=0;return 'wait';}
    // Elimination can destroy the pawn while the game is unfocused. Its fresh
    // result still belongs to this match, but the missing motor reports the
    // default not_started status instead of the original focus_lost reason.
    const eliminatedPawn=['dead','ended'].includes(o.phase)&&!!o.result
      &&o.executor?.status==='released'&&o.executor.reason==='not_started';
    if(!this.requestedFrom&&!eliminatedPawn&&!['focus_lost','lease_expired'].includes(o.executor?.reason??''))return 'stop';
    if(o.frame===this.frame)return 'wait';
    if(!this.stableAt||now-this.lastAt>250)this.stableAt=now;
    this.frame=o.frame;this.lastAt=now;
    if(now-this.stableAt<750)return 'wait';
    this.reset();return 'resume';
  }
}

/** Rearm only a confirmed lease stop in the same authorized, focused match. */
export class EtcLeaseRecovery {
  private identity='';private started=0;private stable=0;private frame=-1;private lastAt=0;
  private resumed:number[]=[];
  reset(){this.identity='';this.started=0;this.stable=0;this.frame=-1;this.lastAt=0;this.resumed=[];}
  poll(o:EtcObservation,epoch:number,now:number):'active'|'wait'|'resume'|'stop'{
    const identity=JSON.stringify([o.session,o.matchId,o.processId]);
    if(o.epoch!==epoch||!o.foreground||o.phase!=='playing'||now-o.timestamp>500||o.timestamp>now+50)return 'stop';
    if(now-o.timestamp>250){
      this.stable=0;
      // Crossing the read deadline never bypasses ownership or release checks.
      return identity===this.identity&&o.mode==='manual'&&o.executor?.status==='released'
        &&o.executor.reason==='lease_expired'&&o.diagnostics.heldInputs===0?'wait':'stop';
    }
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
    if(!this.stable||now-this.lastAt>250)this.stable=now;
    this.frame=o.frame;this.lastAt=now;
    if(now-this.stable<500)return 'wait';
    this.resumed.push(now);this.started=0;this.stable=0;
    return 'resume';
  }
}
