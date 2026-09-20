import { OAuth } from './oauth';
import { jsonRequest } from './http';

export class Platforms {
  constructor(private auth:OAuth) {}
  async youtube(path:string,method='GET',body?:unknown) {
    const c=await this.auth.credentials('youtube');
    return jsonRequest(`https://www.googleapis.com/youtube/v3/${path}`,{method,headers:{Authorization:`Bearer ${c.access_token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
  }
  async twitch(path:string,method='GET',body?:unknown) {
    const c=await this.auth.credentials('twitch');
    if(method==='PATCH') {
      const r=await fetch(`https://api.twitch.tv/helix/${path}`,{method,headers:{Authorization:`Bearer ${c.access_token}`,'Client-Id':c.clientId,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(20000),redirect:'error'});
      if(!r.ok) throw new Error(`Twitch 频道更新失败 (${r.status})。`);return {};
    }
    return jsonRequest(`https://api.twitch.tv/helix/${path}`,{method,headers:{Authorization:`Bearer ${c.access_token}`,'Client-Id':c.clientId,'Content-Type':'application/json'}});
  }
  async twitchDestination(title:string) {
    const c=await this.auth.credentials('twitch');
    const result=await this.twitch(`streams/key?broadcaster_id=${encodeURIComponent(c.account.id)}`);
    if(!result.data?.[0]?.stream_key)throw new Error('Twitch 尚未提供直播推流权限。');
    await this.twitch(`channels?broadcaster_id=${encodeURIComponent(c.account.id)}`,'PATCH',{title});
    return {server:'rtmp://live.twitch.tv/app',key:result.data[0].stream_key,url:`https://www.twitch.tv/${encodeURIComponent(c.account.name)}`};
  }
  async createYouTubeBroadcast(title:string,privacy:string) {
    return this.youtube('liveBroadcasts?part=snippet,status,contentDetails','POST',{snippet:{title,scheduledStartTime:new Date(Date.now()+60000).toISOString()},status:{privacyStatus:privacy,selfDeclaredMadeForKids:false},contentDetails:{enableAutoStart:true,enableAutoStop:true,enableDvr:true,monitorStream:{enableMonitorStream:false}}});
  }
  async createYouTubeStream(title:string) {
    return this.youtube('liveStreams?part=snippet,cdn,contentDetails','POST',{snippet:{title},cdn:{frameRate:'60fps',resolution:'1080p',ingestionType:'rtmp'},contentDetails:{isReusable:false}});
  }
  async bind(broadcast:string,stream:string) { await this.youtube(`liveBroadcasts/bind?part=id,contentDetails&id=${encodeURIComponent(broadcast)}&streamId=${encodeURIComponent(stream)}`,'POST'); }
  async finish(broadcast:string) {
    const result=await this.youtube(`liveBroadcasts?part=status&id=${encodeURIComponent(broadcast)}`);
    const state=result.items?.[0]?.status?.lifeCycleStatus;
    if(state==='complete' || !state)return;
    if(state==='live' || state==='testing') await this.youtube(`liveBroadcasts/transition?part=status&broadcastStatus=complete&id=${encodeURIComponent(broadcast)}`,'POST');
    else {
      const c=await this.auth.credentials('youtube');
      const r=await fetch(`https://www.googleapis.com/youtube/v3/liveBroadcasts?id=${encodeURIComponent(broadcast)}`,{method:'DELETE',headers:{Authorization:`Bearer ${c.access_token}`},signal:AbortSignal.timeout(20000),redirect:'error'});
      if(!r.ok && r.status!==404)throw new Error('YouTube 未开始的直播清理失败。');
    }
  }
}
