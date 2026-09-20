import { credentials, loadPackageDefinition, Metadata, type Client, type ClientReadableStream } from '@grpc/grpc-js';
import { fromJSON } from '@grpc/proto-loader';
// Wire field numbers from Google's documented stream_list.proto. Unused fields are ignored.
// https://developers.google.com/youtube/v3/live/streaming-live-chat (Apache-2.0 code sample)
const field=(type:string,id:number,rule?:string)=>({type,id,...(rule?{rule}:{})});
export const youtubeDefinition=fromJSON({nested:{youtube:{nested:{api:{nested:{v3:{nested:{
 LiveChatMessageListRequest:{fields:{liveChatId:field('string',1),pageToken:field('string',99),part:field('string',100,'repeated')}},
 LiveChatMessageListResponse:{fields:{offlineAt:field('string',2),nextPageToken:field('string',100602),items:field('LiveChatMessage',1007,'repeated')}},
 LiveChatMessage:{fields:{id:field('string',101),snippet:field('Snippet',2),authorDetails:field('Author',3)}},
 Author:{fields:{channelId:field('string',10101),displayName:field('string',103)}},
 Snippet:{fields:{type:field('int32',1),publishedAt:field('string',4),displayMessage:field('string',16),userBannedDetails:field('Ban',22)}},
 Ban:{fields:{bannedUserDetails:field('Channel',1)}},Channel:{fields:{channelId:field('string',101)}},
 V3DataLiveChatMessageService:{methods:{StreamList:{requestType:'LiveChatMessageListRequest',responseType:'LiveChatMessageListResponse',responseStream:true,comment:''}}}
}}}}}}}},{keepCase:false,defaults:false});
const Loaded=loadPackageDefinition(youtubeDefinition) as any;
export interface YouTubeBatch {offlineAt?:string;nextPageToken?:string;items?:{id:string;snippet?:{type:number;publishedAt?:string;displayMessage?:string;userBannedDetails?:{bannedUserDetails?:{channelId?:string}}};authorDetails?:{channelId?:string;displayName?:string}}[]}
export async function* youtubeBatches(token:string,id:string,pageToken:string,signal:AbortSignal):AsyncGenerator<YouTubeBatch>{
 if(signal.aborted)return;
 const client:Client & {StreamList:(request:unknown,metadata:Metadata,options:unknown)=>ClientReadableStream<YouTubeBatch>}=new Loaded.youtube.api.v3.V3DataLiveChatMessageService('youtube.googleapis.com:443',credentials.createSsl(),{'grpc.max_receive_message_length':4*1024*1024});
 const metadata=new Metadata();metadata.set('authorization','Bearer '+token);
 // Periodically reconnect with refreshed OAuth credentials and the last cursor.
 const stream=client.StreamList({liveChatId:id,part:['id','snippet','authorDetails'],...(pageToken?{pageToken}:{})},metadata,{deadline:Date.now()+25*60*1000});
 const abort=()=>stream.cancel();signal.addEventListener('abort',abort,{once:true});
 try{for await(const batch of stream){if(signal.aborted)return;yield batch as YouTubeBatch;}}
 finally{signal.removeEventListener('abort',abort);stream.cancel();client.close();}
}
