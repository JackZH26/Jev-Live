import {afterEach,expect,it,vi} from 'vitest';
import {boundObsRequests} from '../electron/obs-deadline';
afterEach(()=>vi.useRealTimers());
it('releases a stalled OBS request and disconnects only that client',async()=>{
 vi.useFakeTimers();const disconnect=vi.fn().mockResolvedValue(undefined);
 const client=boundObsRequests({call:vi.fn(()=>new Promise(()=>{})),disconnect},100);
 const outcome=expect(client.call('GetStreamStatus')).rejects.toThrow('OBS request timed out');
 await vi.advanceTimersByTimeAsync(100);await outcome;expect(disconnect).toHaveBeenCalledTimes(1);
});
it('does not disconnect a healthy request after its deadline',async()=>{
 vi.useFakeTimers();const disconnect=vi.fn().mockResolvedValue(undefined);
 const client=boundObsRequests({call:vi.fn().mockResolvedValue({active:true}),disconnect},100);
 await expect(client.call('GetStreamStatus')).resolves.toEqual({active:true});await vi.advanceTimersByTimeAsync(200);expect(disconnect).not.toHaveBeenCalled();
});
