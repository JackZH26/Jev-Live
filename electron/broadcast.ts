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
  async init() { const journal=await this.store.get<Journal>('broadcast');if(journal && journal.state!=='idle') { this.state={...journal,state:'recovery'};this.log('发现上次直播记录，请连接 OBS 后检查状态或结束直播。'); } }
  private async save() { await this.store.set('broadcast',this.state); }
  async start() {
    if(this.locked || this.state.state!=='idle')throw new Error('当前直播任务尚未结束。');
    this.locked=true;
    try {
      const settings=await this.store.settings();
      const accounts=await this.auth.accounts();
      if(!accounts.youtube || !accounts.twitch)throw new Error('请先完成 YouTube 和 Twitch 官方登录。');
      await this.obs.poll();
      if(!settings.gameWindow)throw new Error('请先选择游戏窗口并检查两路预览。');
      for(const p of ['youtube','twitch'] as const) {
        if(!this.obs.states[p].connected || !this.obs.states[p].ready)throw new Error('请先准备两路 OBS。');
        if(this.obs.states[p].active)throw new Error('OBS 已经在推流，请先恢复或结束现有直播。');
      }
      if(!(await this.obs.windows()).some(w=>w.value===settings.gameWindow))throw new Error('所选游戏窗口已关闭。');
      await this.auth.validateTwitch();
      this.state={state:'preparing'};await this.save();
      const twitch=await this.platforms.twitchDestination(settings.title);
      const broadcast=await this.platforms.createYouTubeBroadcast(settings.title,settings.youtubePrivacy);
      this.state.youtubeId=broadcast.id;this.state.youtubeUrl=`https://www.youtube.com/watch?v=${broadcast.id}`;await this.save();
      const stream=await this.platforms.createYouTubeStream(settings.title);
      this.state.streamId=stream.id;await this.save();
      await this.platforms.bind(broadcast.id,stream.id);
      const ingest=stream.cdn?.ingestionInfo;
      if(!ingest?.streamName || !ingest.ingestionAddress)throw new Error('YouTube 没有返回推流地址。');
      await this.obs.service('youtube',ingest.rtmpsIngestionAddress||ingest.ingestionAddress,ingest.streamName);
      await this.obs.service('twitch',twitch.server,twitch.key);
      // Both services prepared before either output is started.
      await this.obs.start('youtube');await this.obs.start('twitch');
      this.state={...this.state,state:'sending',twitchUrl:twitch.url};await this.save();
      this.log('两路 OBS 已开始推送。请通过频道链接检查平台接收画面与声音。');
    } catch(e) {
      if(this.state.state==='preparing') {
        const results=await Promise.allSettled((['youtube','twitch'] as const).map(p=>this.obs.stop(p)));
        let clean=results.every(r=>r.status==='fulfilled');
        if(this.state.youtubeId) { try {await this.platforms.finish(this.state.youtubeId);}catch{clean=false;} }
        this.state=clean?{state:'idle'}:{...this.state,state:'recovery'};await this.save();
        await Promise.allSettled((['youtube','twitch'] as const).map(p=>this.obs.clearKey(p)));
        this.log(clean?'启动失败，已停止本次两路推流。':'启动未完成；部分资源需要恢复检查，请点击结束直播。');
      }
      throw e;
    } finally { this.locked=false; }
  }
  async stop() {
    if(this.locked)throw new Error('正在执行直播操作，请稍候。');this.locked=true;
    try {
      this.state.state='stopping';await this.save();
      const results=await Promise.allSettled((['youtube','twitch'] as const).map(p=>this.obs.stop(p)));
      if(results.some(r=>r.status==='rejected')) { this.state.state='recovery';await this.save();throw new Error('部分 OBS 未确认停止，请重新连接后再结束直播。'); }
      if(this.state.youtubeId)await this.platforms.finish(this.state.youtubeId);
      await Promise.allSettled((['youtube','twitch'] as const).map(p=>this.obs.clearKey(p)));
      this.state={state:'idle'};await this.save();this.log('两路推流已结束。游戏模式保持不变。');
    } catch(e) { this.state.state='recovery';await this.save();throw e; }
    finally {this.locked=false;}
  }
}
