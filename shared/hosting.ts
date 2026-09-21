import { z } from 'zod';
import { providers, type Provider, type OAuthProvider } from './types';
export const rectSchema=z.object({x:z.number().min(0).max(1910),y:z.number().min(0).max(1070),width:z.number().min(40).max(1920),height:z.number().min(40).max(1080),visible:z.boolean(),locked:z.boolean()}).refine(r=>r.x+r.width<=1920&&r.y+r.height<=1080);
export type LayerRect=z.infer<typeof rectSchema>;
export const defaultLayout=()=>({game:{x:0,y:0,width:1920,height:1080,visible:true,locked:false},avatar:{x:40,y:600,width:400,height:480,visible:true,locked:false},chat:{x:1500,y:510,width:390,height:530,visible:true,locked:false},captions:{x:460,y:910,width:1000,height:120,visible:true,locked:false}});
export const layoutSchema=z.object({game:rectSchema,avatar:rectSchema,chat:rectSchema,captions:rectSchema});
export type Layout=z.infer<typeof layoutSchema>;export type Layer=keyof Layout;
export function validModelBase(raw:string){try{const u=new URL(raw);return !u.username&&!u.password&&!u.search&&!u.hash&&['http:','https:'].includes(u.protocol)&&['localhost','127.0.0.1','[::1]'].includes(u.hostname);}catch{return false;}}
export const hostConfigSchema=z.object({
 layouts:z.object({youtube:layoutSchema,twitch:layoutSchema,x:layoutSchema}).default(()=>({youtube:defaultLayout(),twitch:defaultLayout(),x:defaultLayout()})),
 avatar:z.object({kind:z.enum(['builtin','image','vrm']).default('builtin'),asset:z.string().regex(/^$|^[a-f0-9]{32}\.(png|webp|jpg|vrm)$/).default(''),name:z.string().trim().min(1).max(40).default('JEV'),color:z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#9b8cff')}).default(()=>({kind:'builtin' as const,asset:'',name:'JEV',color:'#9b8cff'})),
 persona:z.string().max(3000).default('A friendly, curious gaming companion. Keep reactions concise, varied and grounded in visible game information. Be honest when uncertain.'),
 language:z.enum(['zh-CN','zh-TW','ja','ko','en']).default('en'),voice:z.string().max(200).default(''),
 speechProvider:z.enum(['system','qwen','qwen-clone','melo']).default('melo'),neuralVoice:z.enum(['','aiden','dylan','eric','ono_anna','ryan','serena','sohee','uncle_fu','vivian']).default(''),
 voiceClone:z.object({asset:z.string().regex(/^$|^[a-f0-9]{32}\.wav$/).default(''),name:z.string().max(160).default(''),text:z.string().max(2000).default('')}).default(()=>({asset:'',name:'',text:''})),
 pace:z.enum(['calm','balanced','lively']).default('balanced'),
 blockedWords:z.array(z.string().trim().min(1).max(50)).max(50).default([]),
 speech:z.boolean().default(true),textReplies:z.boolean().default(false),commentary:z.boolean().default(true),
 intervalSec:z.number().int().min(15).max(300).default(40),replyCooldownSec:z.number().int().min(5).max(120).default(12),maxPerHour:z.number().int().min(1).max(240).default(90),
 modelProvider:z.enum(['ollama','compatible']).default('ollama'),compute:z.enum(['auto','cpu']).default('cpu'),
 apiBase:z.string().max(500).refine(v=>!v||validModelBase(v)).default('http://127.0.0.1:11434'),model:z.string().max(150).refine(v=>!v||/^[\w.:/-]+$/.test(v)&&!/(?:cloud|https?:)/i.test(v)).default('qwen3.5:4b'),chatPlatforms:z.array(z.enum(['youtube','twitch'])).max(2).refine(a=>new Set(a).size===a.length).default(['youtube','twitch'])
});
export type HostConfig=z.infer<typeof hostConfigSchema>;
/** Current release uses English speech; keep old experimental settings readable for migration. */
export function englishHostConfig(value:unknown):HostConfig{
 const config=hostConfigSchema.parse(value);
 return {...config,language:'en',speechProvider:config.speechProvider==='system'?'system':'melo'};
}
export interface ChatMessage{id:string;platform:OAuthProvider;authorId:string;author:string;text:string;at:number;self:boolean;simulation?:boolean}
export interface ChatStatus{state:'off'|'connecting'|'connected'|'waiting'|'reauthorize'|'error';received:number;sent:number;error?:string}
export interface Utterance{id:string;text:string;scope:Provider|'all';audio?:string;at:number;expires:number;language?:HostConfig['language'];replyTo?:string}
export const overlayEvents=['started','ended','stateError','audioError','recovered','expired','interrupted'] as const;
export type OverlayEvent=typeof overlayEvents[number];
export interface OverlayHealth{lastSeen:number;audioStarted:number;audioEnded:number;audioErrors:number;stateErrors:number;recovered:number;expired:number;interrupted:number;lastError?:{kind:'state'|'audio';code:string;at:number}}
export const blankOverlay=():OverlayHealth=>({lastSeen:0,audioStarted:0,audioEnded:0,audioErrors:0,stateErrors:0,recovered:0,expired:0,interrupted:0});
export interface HostSnapshot{config:HostConfig;assetUrl?:string;running:boolean;warming:boolean;hasKey:boolean;utterance:Utterance|null;messages:ChatMessage[];chat:Record<OAuthProvider,ChatStatus>;error:string;voices:{name:string;language:string}[];stats:{startedAt:number;generated:number;spoken:number;replies:number;failures:number};overlay:Record<Provider,OverlayHealth>;timing:{modelMs:number;speechMs:number;responseP95Ms:number}}
export interface OverlayState{gameConnected?:boolean;simulation?:boolean;layout:Layout;avatar:HostConfig['avatar'];messages:ChatMessage[];utterance:Utterance|null;provider:Provider;language:HostConfig['language']}
export interface HostingAPI{hostSnapshot():Promise<HostSnapshot>;saveHostConfig(config:HostConfig):Promise<void>;saveHostLayouts(layouts:HostConfig['layouts']):Promise<void>;saveHostKey(key:string):Promise<void>;importAvatar():Promise<boolean>;importVoiceReference():Promise<boolean>;startHost():Promise<void>;stopHost():Promise<void>;testHostVoice(language?:HostConfig['language']):Promise<string>;applyHostLayout():Promise<void>;gamePreview(provider:Provider):Promise<string>}
export const clampRect=(r:LayerRect):LayerRect=>{const width=Math.min(1920,Math.max(40,Math.round(r.width))),height=Math.min(1080,Math.max(40,Math.round(r.height)));return {...r,width,height,x:Math.max(0,Math.min(1920-width,Math.round(r.x))),y:Math.max(0,Math.min(1080-height,Math.round(r.y)))};};
export const allProviders=providers;
