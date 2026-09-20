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
 language:z.enum(['zh-CN','zh-TW','ja','ko','en']).default('zh-CN'),voice:z.string().max(200).default(''),
 speech:z.boolean().default(true),textReplies:z.boolean().default(false),commentary:z.boolean().default(true),
 intervalSec:z.number().int().min(15).max(300).default(40),replyCooldownSec:z.number().int().min(5).max(120).default(12),maxPerHour:z.number().int().min(1).max(240).default(90),
 modelProvider:z.enum(['ollama','compatible']).default('ollama'),compute:z.enum(['auto','cpu']).default('cpu'),
 apiBase:z.string().max(500).refine(v=>!v||validModelBase(v)).default('http://127.0.0.1:11434'),model:z.string().max(150).refine(v=>!v||/^[\w.:/-]+$/.test(v)&&!/(?:cloud|https?:)/i.test(v)).default('qwen3.5:4b'),chatPlatforms:z.array(z.enum(['youtube','twitch'])).max(2).refine(a=>new Set(a).size===a.length).default(['youtube','twitch'])
});
export type HostConfig=z.infer<typeof hostConfigSchema>;
export interface ChatMessage{id:string;platform:OAuthProvider;authorId:string;author:string;text:string;at:number;self:boolean}
export interface ChatStatus{state:'off'|'connecting'|'connected'|'waiting'|'reauthorize'|'error';received:number;sent:number;error?:string}
export interface Utterance{id:string;text:string;scope:Provider|'all';audio?:string;at:number;expires:number}
export interface HostSnapshot{config:HostConfig;assetUrl?:string;running:boolean;warming:boolean;hasKey:boolean;utterance:Utterance|null;messages:ChatMessage[];chat:Record<OAuthProvider,ChatStatus>;error:string;voices:{name:string;language:string}[];stats:{startedAt:number;generated:number;spoken:number;replies:number;failures:number};overlay:Record<Provider,{lastSeen:number;audioStarted:number;audioErrors:number}>}
export interface OverlayState{layout:Layout;avatar:HostConfig['avatar'];messages:ChatMessage[];utterance:Utterance|null;provider:Provider;language:HostConfig['language']}
export interface HostingAPI{hostSnapshot():Promise<HostSnapshot>;saveHostConfig(config:HostConfig):Promise<void>;saveHostLayouts(layouts:HostConfig['layouts']):Promise<void>;saveHostKey(key:string):Promise<void>;importAvatar():Promise<boolean>;startHost():Promise<void>;stopHost():Promise<void>;testHostVoice():Promise<string>;applyHostLayout():Promise<void>;gamePreview(provider:Provider):Promise<string>}
export const clampRect=(r:LayerRect):LayerRect=>{const width=Math.min(1920,Math.max(40,Math.round(r.width))),height=Math.min(1080,Math.max(40,Math.round(r.height)));return {...r,width,height,x:Math.max(0,Math.min(1920-width,Math.round(r.x))),y:Math.max(0,Math.min(1080-height,Math.round(r.y)))};};
export const allProviders=providers;
