import { OAuth } from './oauth';
import { Platforms } from './platforms';
import { youtubeBatches } from './youtube-stream';
import type { ChatMessage, ChatStatus } from '../shared/hosting';
import type { OAuthProvider } from '../shared/types';
export const chatScopes=['user:read:chat','user:write:chat'];
const blank=():ChatStatus=>({state:'off',received:0,sent:0});
export function trustedReconnect(raw:string){try{const u=new URL(raw);return u.protocol==='wss:'&&u.hostname==='eventsub.wss.twitch.tv'&&!u.username&&!u.password&&(!u.port||u.port==='443');}catch{return false;}}
export class Chat {
 readonly status={youtube:blank(),twitch:blank()};readonly messages:ChatMessage[]=[];
 private seen=new Set<string>();private controller?:AbortController;private sockets=new Set<WebSocket>();private timers=new Set<ReturnType<typeof setTimeout>>();private youtubeId='';private lastSend={youtube:0,twitch:0};private platform:Platforms;
 constructor(private auth:OAuth,private receive:(m:ChatMessage)=>void){this.platform=new Platforms(auth);}
 private schedule(fn:()=>void,ms:number){const timer=setTimeout(()=>{this.timers.delete(timer);if(!this.controller?.signal.aborted)fn();},ms);this.timers.add(timer);}
 private add(m:ChatMessage,notify=true){const id=m.platform+':'+m.id;if(this.seen.has(id))return;this.seen.add(id);if(this.seen.size>3000)this.seen.delete(this.seen.values().next().value!);this.messages.push(m);if(this.messages.length>200)this.messages.shift();this.status[m.platform].received++;if(notify&&!m.self)this.receive(m);}
 private remove(platform:OAuthProvider,predicate:(m:ChatMessage)=>boolean){for(let i=this.messages.length-1;i>=0;i--)if(this.messages[i].platform===platform&&predicate(this.messages[i]))this.messages.splice(i,1);}
 async start(providers:OAuthProvider[],youtubeId?:string){this.stop();this.controller=new AbortController();this.youtubeId='';for(const p of providers){this.status[p]=blank();this.status[p].state='connecting';if(p==='youtube')void this.youtube(youtubeId);else void this.twitch();}}
 stop(){this.controller?.abort();for(const t of this.timers)clearTimeout(t);this.timers.clear();for(const s of this.sockets){s.onclose=null;s.close();}this.sockets.clear();for(const p of ['youtube','twitch'] as const)this.status[p].state='off';}
 private async youtube(broadcastId?:string,pageToken='',failures=0){const signal=this.controller!.signal;if(signal.aborted)return;try{
  if(!this.youtubeId){const data=await this.platform.youtube('liveBroadcasts?part=snippet&'+(broadcastId?'id='+encodeURIComponent(broadcastId):'broadcastStatus=active&broadcastType=all'),'GET',undefined,signal);if(signal.aborted)return;this.youtubeId=data.items?.[0]?.snippet?.liveChatId??'';if(!this.youtubeId){this.status.youtube.state='waiting';this.schedule(()=>void this.youtube(undefined),30000);return;}}
  const c=await this.auth.credentials('youtube');if(signal.aborted)return;const connectedAt=Date.now();
  for await(const data of youtubeBatches(c.access_token,this.youtubeId,pageToken,signal)){
   if(signal.aborted)return;this.status.youtube.state='connected';this.status.youtube.error=undefined;failures=0;
   for(const item of data.items??[]){const s=item.snippet??{type:0};if(s.type===2){this.remove('youtube',m=>m.id===item.id);continue;}if(s.type===10){const author=s.userBannedDetails?.bannedUserDetails?.channelId;if(author)this.remove('youtube',m=>m.authorId===author);continue;}if(s.type!==1)continue;const at=Date.parse(s.publishedAt??'')||0;this.add({id:item.id,platform:'youtube',authorId:item.authorDetails?.channelId??'',author:String(item.authorDetails?.displayName??'Viewer').slice(0,80),text:String(s.displayMessage??'').slice(0,600),at,self:item.authorDetails?.channelId===c.account.id},!!pageToken&&at>=connectedAt-60000);}
   pageToken=data.nextPageToken??pageToken;if(data.offlineAt){this.youtubeId='';pageToken='';this.status.youtube.state='waiting';break;}
  }
  if(!signal.aborted)this.schedule(()=>void this.youtube(undefined,pageToken),this.youtubeId?2000:30000);
 }catch(e:any){if(signal.aborted)return;if([5,9].includes(e.code)){this.youtubeId='';pageToken='';}this.status.youtube.state='error';this.status.youtube.error='host.youtubeChatError';this.schedule(()=>void this.youtube(undefined,pageToken,failures+1),Math.min(120000,15000*2**Math.min(failures,3)));}}
 private async twitch(url='wss://eventsub.wss.twitch.tv/ws',handoff?:WebSocket,failures=0){const signal=this.controller!.signal;if(signal.aborted)return;
  try{const c=await this.auth.credentials('twitch');if(signal.aborted)return;const scopes=typeof c.scope==='string'?c.scope.split(' '):c.scope??[];if(!chatScopes.every(s=>scopes.includes(s))){this.status.twitch.state='reauthorize';return;}
   const ws=new WebSocket(url);this.sockets.add(ws);let alive=Date.now(),keepalive=10000,welcomed=false,reconnecting=false;
   const watch=()=>{if(signal.aborted||ws.readyState>=2)return;if(Date.now()-alive>keepalive+10000){ws.close();return;}this.schedule(watch,5000);};this.schedule(watch,5000);
   ws.onmessage=event=>{void (async()=>{if(signal.aborted)return;alive=Date.now();const data=JSON.parse(String(event.data));const type=data.metadata?.message_type;
    if(type==='session_welcome'){welcomed=true;keepalive=(data.payload.session.keepalive_timeout_seconds??10)*1000;
     if(!handoff){for(const type of ['channel.chat.message','channel.chat.message_delete','channel.chat.clear','channel.chat.clear_user_messages']){const response=await fetch('https://api.twitch.tv/helix/eventsub/subscriptions',{method:'POST',headers:{Authorization:`Bearer ${c.access_token}`,'Client-Id':c.clientId,'Content-Type':'application/json'},body:JSON.stringify({type,version:'1',condition:{broadcaster_user_id:c.account.id,user_id:c.account.id},transport:{method:'websocket',session_id:data.payload.session.id}}),signal:AbortSignal.any([signal,AbortSignal.timeout(15000)]),redirect:'error'});if(!response.ok)throw new Error('subscribe');}}
     else {handoff.onclose=null;handoff.close();this.sockets.delete(handoff);}if(signal.aborted)return;this.status.twitch.state='connected';this.status.twitch.error=undefined;
    }else if(type==='session_reconnect'){if(reconnecting)return;reconnecting=true;const target=data.payload?.session?.reconnect_url;if(!trustedReconnect(target))throw new Error('reconnect');void this.twitch(target,ws);
    }else if(type==='revocation'){this.status.twitch.state='reauthorize';ws.onclose=null;ws.close();this.sockets.delete(ws);
    }else if(type==='notification'){const e=data.payload?.event??{},sub=data.payload?.subscription?.type;
     if(sub==='channel.chat.message')this.add({id:e.message_id,platform:'twitch',authorId:e.chatter_user_id,author:String(e.chatter_user_name??'Viewer').slice(0,80),text:String(e.message?.text??'').slice(0,600),at:Date.parse(data.metadata.message_timestamp)||Date.now(),self:e.chatter_user_id===c.account.id});
     if(sub==='channel.chat.message_delete')this.remove('twitch',m=>m.id===e.message_id);
     if(sub==='channel.chat.clear_user_messages')this.remove('twitch',m=>m.authorId===e.target_user_id);
     if(sub==='channel.chat.clear')this.remove('twitch',()=>true);
    }
   })().catch(()=>{if(signal.aborted)return;this.status.twitch.state='error';this.status.twitch.error='host.twitchChatError';ws.close();});};
   ws.onerror=()=>{};ws.onclose=()=>{this.sockets.delete(ws);if(signal.aborted)return;this.status.twitch.state='connecting';this.schedule(()=>void this.twitch(undefined,undefined,welcomed?0:failures+1),Math.min(60000,2000*2**Math.min(failures,5)));};
  }catch{if(signal.aborted)return;this.status.twitch.state='error';this.status.twitch.error='host.twitchChatError';this.schedule(()=>void this.twitch(undefined,undefined,failures+1),Math.min(60000,5000*2**Math.min(failures,4)));}
 }
 async send(m:ChatMessage,text:string){if(!this.controller||this.controller.signal.aborted||this.status[m.platform].state!=='connected')throw new Error('host.chatOffline');if(Date.now()-this.lastSend[m.platform]<5000)throw new Error('host.chatRate');this.lastSend[m.platform]=Date.now();const signal=AbortSignal.any([this.controller.signal,AbortSignal.timeout(15000)]);
  if(m.platform==='youtube'){if(!this.youtubeId)throw new Error('host.chatOffline');await this.platform.youtube('liveChat/messages?part=snippet','POST',{snippet:{liveChatId:this.youtubeId,type:'textMessageEvent',textMessageDetails:{messageText:text.slice(0,200)}}},signal);}
  else{const c=await this.auth.credentials('twitch');const r=await fetch('https://api.twitch.tv/helix/chat/messages',{method:'POST',headers:{Authorization:`Bearer ${c.access_token}`,'Client-Id':c.clientId,'Content-Type':'application/json'},body:JSON.stringify({broadcaster_id:c.account.id,sender_id:c.account.id,message:text.slice(0,450),reply_parent_message_id:m.id}),signal,redirect:'error'});if(!r.ok)throw new Error('host.chatSendFailed');const data=await r.json() as any;if(!data.data?.[0]?.is_sent)throw new Error('host.chatSendFailed');}
  this.status[m.platform].sent++;
 }
}
