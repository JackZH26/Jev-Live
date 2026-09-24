import {it,expect,vi} from 'vitest';
import {Obs} from '../electron/obs';
import {settingsSchema} from '../electron/storage';
it.each(['x','twitch','youtube'] as const)('pure gameplay hides every overlay and mutes host audio on %s',async provider=>{
 const obs=new Obs({} as any,()=>{});obs.states[provider].connected=true;
 const call=vi.fn(async(name:string)=>name==='GetSceneItemList'?{sceneItems:[{sourceName:'ETC Game',sceneItemId:1},{sourceName:'ETC Audio',sceneItemId:2},{sourceName:'JEV Host',sceneItemId:3},{sourceName:'JEV Test Status',sceneItemId:4}]}:{sceneItemId:1});
 (obs as any).clients[provider]={call};await obs.gameplay(provider);
 for(const id of [1,2,3,4])expect(call).toHaveBeenCalledWith('SetSceneItemEnabled',{sceneName:'JEV Program',sceneItemId:id,sceneItemEnabled:id<=2});
 expect(call).toHaveBeenCalledWith('SetInputMute',{inputName:'JEV Host',inputMuted:true});
 expect(call).toHaveBeenCalledWith('SetSceneItemTransform',expect.objectContaining({sceneItemTransform:expect.objectContaining({positionX:0,positionY:0,boundsWidth:1920,boundsHeight:1080})}));
 expect(call.mock.calls.some(([name])=>name==='SetInputVolume'||name==='StopStream')).toBe(false);
});
it('migrates old settings to host presentation while preserving an explicit gameplay selection',()=>{
 expect(settingsSchema.parse({}).presentation).toBe('host');expect(settingsSchema.parse({presentation:'gameplay'}).presentation).toBe('gameplay');
 expect(settingsSchema.safeParse({presentation:'invalid'}).success).toBe(false);
});
