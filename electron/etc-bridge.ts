import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { atomicWrite } from './storage';
import { ETC_LEASE_MS, ETC_MAX_AGE_MS, etcObservationSchema, type EtcCommand, type EtcObservation } from '../shared/etc';

/** Private mailbox shared with the installed game's opt-in runtime integration. */
export class EtcBridge {
  readonly session=randomUUID();private token=randomBytes(32).toString('hex');
  private id=0;private heartbeatAt=0;private lastFrame=-1;private closing=false;private pid=0;
  private latestEpoch=0;private writes:Promise<unknown>=Promise.resolve();
  constructor(readonly directory:string,private write=atomicWrite){}
  async heartbeat(now=Date.now(),pid=this.pid){
    if(this.closing||(pid===this.pid&&now-this.heartbeatAt<1000))return;
    await mkdir(this.directory,{recursive:true});
    await this.write(join(this.directory,'session.json'),JSON.stringify({version:3,session:this.session,token:this.token,processId:pid,expiresAt:now+3000}));
    this.heartbeatAt=now;if(this.pid!==pid)this.lastFrame=-1;this.pid=pid;
  }
  async read(pid:number|undefined,now=Date.now()):Promise<EtcObservation|null>{
    await this.heartbeat(now,pid??0);
    try{
      const file=join(this.directory,'state.json');if((await stat(file)).size>128000)return null;
      const raw=await readFile(file,'utf8');if(raw.length>128000)return null;
      const parsed=etcObservationSchema.safeParse(JSON.parse(raw));if(!parsed.success)return null;
      const o=parsed.data;
      if(!pid||o.processId!==pid||o.session!==this.session||now-o.timestamp>ETC_MAX_AGE_MS||o.timestamp>now+50||o.frame<this.lastFrame)return null;
      this.lastFrame=o.frame;return o;
    }catch{return null;}
  }
  async command(mode:'auto'|'manual',epoch:number,o:EtcObservation|null,action='',now=Date.now()){
    if(epoch<this.latestEpoch||(this.closing&&mode==='auto'))return;
    this.latestEpoch=epoch;
    const id=++this.id;
    const work=this.writes.then(async()=>{
      if(epoch<this.latestEpoch||(this.closing&&mode==='auto'))return;
      const at=Math.max(now,Date.now());
      if(mode==='auto'&&(!o||at-o.timestamp>ETC_MAX_AGE_MS||o.timestamp>at+50||!o.foreground||o.session!==this.session))return;
      const command:EtcCommand={version:3,session:this.session,matchId:o?.matchId??'',token:this.token,id,epoch,mode,frame:o?.frame??0,expiresAt:at+ETC_LEASE_MS,action};
      await mkdir(this.directory,{recursive:true});
      await this.write(join(this.directory,'command.json'),JSON.stringify(command));
      return true;
    });
    this.writes=work.catch(()=>{});return work;
  }
  async close(epoch:number){this.closing=true;await this.command('manual',epoch,null);await this.write(join(this.directory,'session.json'),JSON.stringify({version:3,session:this.session,token:this.token,processId:this.pid,expiresAt:0}));}
}
