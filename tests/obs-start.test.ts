import {afterEach,expect,it,vi} from 'vitest';
import {Obs} from '../electron/obs';
afterEach(()=>vi.useRealTimers());
it('restores a muted rehearsal source to the stream track without changing mix volume',async()=>{
 const obs=new Obs({} as any,()=>{});obs.states.x.connected=true;
 const call=vi.fn(async(name:string)=>name==='GetSceneItemId'?{sceneItemId:7}:name==='GetInputAudioTracks'?{inputAudioTracks:{'1':false,'2':false,'3':true}}:{outputActive:true,outputReconnecting:false});
 (obs as any).clients.x={call};await obs.start('x');
 expect(call).toHaveBeenCalledWith('SetInputMute',{inputName:'ETC Audio',inputMuted:false});
 expect(call).toHaveBeenCalledWith('SetSceneItemEnabled',{sceneName:'JEV Program',sceneItemId:7,sceneItemEnabled:true});
 expect(call).toHaveBeenCalledWith('SetInputAudioTracks',{inputName:'ETC Audio',inputAudioTracks:{'1':true,'2':false,'3':true}});
 expect(call.mock.calls.findIndex(([n])=>n==='SetInputMute')).toBeLessThan(call.mock.calls.findIndex(([n])=>n==='StartStream'));
 expect(call.mock.calls.some(([n])=>n==='SetInputVolume')).toBe(false);
});
it('does not start silently when restoring the game source fails',async()=>{
 const obs=new Obs({} as any,()=>{});obs.states.x.connected=true;const call=vi.fn().mockRejectedValue(new Error('missing game audio'));
 (obs as any).clients.x={call};await expect(obs.start('x')).rejects.toThrow('missing game audio');expect(call).not.toHaveBeenCalledWith('StartStream');
});
it('waits through starting/reconnecting before claiming an OBS stream is active',async()=>{vi.useFakeTimers();const obs=new Obs({} as any,()=>{});obs.states.twitch.connected=true;let polls=0;(obs as any).clients.twitch={call:vi.fn(async(name:string)=>name==='GetStreamStatus'?{outputActive:++polls>=2,outputReconnecting:polls===2}:name==='GetSceneItemId'?{sceneItemId:3}:{inputAudioTracks:{'1':false,'2':false}})};const start=obs.start('twitch');await vi.advanceTimersByTimeAsync(500);expect(obs.states.twitch.active).toBe(false);await vi.advanceTimersByTimeAsync(500);await start;expect(obs.states.twitch.active).toBe(true);expect(polls).toBe(3);});
it('reports a timed-out encoder instead of returning a false success',async()=>{vi.useFakeTimers();const obs=new Obs({} as any,()=>{});obs.states.youtube.connected=true;(obs as any).clients.youtube={call:async()=>({outputActive:false,outputReconnecting:false})};const result=obs.start('youtube').catch(e=>e);await vi.advanceTimersByTimeAsync(30000);expect((await result).message).toContain('error.obsStart');expect(obs.states.youtube.active).toBe(false);});
