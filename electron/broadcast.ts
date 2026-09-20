import { message } from '../shared/i18n';
import type { Provider } from '../shared/types';
import { Store } from './storage';
import { Obs } from './obs';
import { OAuth } from './oauth';
import { Platforms } from './platforms';
interface Journal { youtubeId?:string; streamId?:string; youtubeUrl?:string; twitchUrl?:string; state:string }
/** Owns only the broadcast resources created by this session, with durable recovery. */
export class Broadcast {
  state:Journal={state:'idle'};private locked=false;
  constructor(private store:Store,private obs:Obs,private auth:OAuth,private platforms:Platforms,private log:(message:string)=>void) {}
  async init() { const journal=await this.store.get<Journal>('broadcast');if(journal && journal.state!=='idle') { this.state={...journal,state:'recovery'};this.log(message('event.recovery')); } }
  private async save() { await this.store.set('broadcast',this.state); }
  async start() {
    if(this.locked || this.state.state!=='idle')throw new Error(message('error.livePending'));
    this.locked=true;
    try {
      const settings=await this.store.settings();
      if(!settings.steamAppId||!settings.addedSteamGames.includes(settings.steamAppId))throw new Error(message('error.steamSelection'));
      const accounts=await this.auth.accounts();
      if(!accounts.youtube || !accounts.twitch)throw new Error(message('error.accountsFirst'));
      await this.obs.poll();
      if(!settings.gameWindow)throw new Error(message('error.captureFirst'));
      for(const p of ['youtube','twitch'] as const) {
        if(!this.obs.states[p].connected || !this.obs.states[p].ready)throw new Error(message('error.obsFirst'));
        if(this.obs.states[p].active)throw new Error(message('error.alreadyStreaming'));
      }
      if(!(await this.obs.windows()).some(w=>w.value===settings.gameWindow))throw new Error(message('error.selectedGone'));
      await this.auth.validateTwitch();
      this.state={state:'preparing'};await this.save();
      const twitch=await this.platforms.twitchDestination(settings.title);
      const broadcast=await this.platforms.createYouTubeBroadcast(settings.title,settings.youtubePrivacy);
      this.state.youtubeId=broadcast.id;this.state.youtubeUrl=`https://www.youtube.com/watch?v=${broadcast.id}`;await this.save();
      const stream=await this.platforms.createYouTubeStream(settings.title);
      this.state.streamId=stream.id;await this.save();
      await this.platforms.bind(broadcast.id,stream.id);
      const ingest=stream.cdn?.ingestionInfo;
      if(!ingest?.streamName || !ingest.ingestionAddress)throw new Error(message('error.youtubeDestination'));
      await this.obs.service('youtube',ingest.rtmpsIngestionAddress||ingest.ingestionAddress,ingest.streamName);
      await this.obs.service('twitch',twitch.server,twitch.key);
      // Both services prepared before either output is started.
      await this.obs.start('youtube');await this.obs.start('twitch');
      this.state={...this.state,state:'sending',twitchUrl:twitch.url};await this.save();
      this.log(message('event.sending'));
    } catch(e) {
      if(this.state.state==='preparing') {
        const results=await Promise.allSettled((['youtube','twitch'] as const).map(p=>this.obs.stop(p)));
        let clean=results.every(r=>r.status==='fulfilled');
        if(this.state.youtubeId) { try {await this.platforms.finish(this.state.youtubeId);}catch{clean=false;} }
        this.state=clean?{state:'idle'}:{...this.state,state:'recovery'};await this.save();
        await Promise.allSettled((['youtube','twitch'] as const).map(p=>this.obs.clearKey(p)));
        this.log(clean?message('event.rolledBack'):message('event.partialRecovery'));
      }
      throw e;
    } finally { this.locked=false; }
  }
  async stop() {
    if(this.locked)throw new Error(message('error.liveBusy'));this.locked=true;
    try {
      this.state.state='stopping';await this.save();
      const results=await Promise.allSettled((['youtube','twitch'] as const).map(p=>this.obs.stop(p)));
      if(results.some(r=>r.status==='rejected')) { this.state.state='recovery';await this.save();throw new Error(message('error.stopUnconfirmed')); }
      if(this.state.youtubeId)await this.platforms.finish(this.state.youtubeId);
      await Promise.allSettled((['youtube','twitch'] as const).map(p=>this.obs.clearKey(p)));
      this.state={state:'idle'};await this.save();this.log(message('event.stopped'));
    } catch(e) { this.state.state='recovery';await this.save();throw e; }
    finally {this.locked=false;}
  }
}
