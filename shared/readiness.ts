import type {Snapshot} from './types';
export interface ReadinessCheck {id:string;key:string;ready:boolean;required:boolean;action:'steam'|'accounts'|'obs'|'capture'|'host';provider?:string}
export interface ReadinessReport {at:number;checks:ReadinessCheck[];canStream:boolean;canHost:boolean}
export function streamChecks(s:Snapshot):ReadinessCheck[]{
 const selected=s.settings.enabledPlatforms;
 return [{id:'game',key:'setup.game',ready:!!s.selectedGame,required:true,action:'steam'},
 {id:'running',key:'setup.running',ready:s.gameConnected,required:true,action:'steam'},
 {id:'platforms',key:'setup.platforms',ready:!!selected.length,required:true,action:'accounts'},
 ...selected.map(p=>({id:'account-'+p,key:'setup.account',provider:p,ready:p==='x'?s.xSource.configured:!!s.accounts[p],required:true,action:'accounts' as const})),
 ...selected.map(p=>({id:'obs-'+p,key:'setup.obs',provider:p,ready:s.outputs[p].connected&&s.outputs[p].ready,required:true,action:'obs' as const})),
 {id:'capture',key:'setup.capture',ready:!!s.settings.gameWindow&&s.gameConnected,required:true,action:'capture'}];
}
