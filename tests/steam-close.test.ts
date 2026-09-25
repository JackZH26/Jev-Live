import {afterEach,it,expect,vi} from 'vitest';
const execute=vi.hoisted(()=>vi.fn());
vi.mock('node:child_process',()=>({execFile:execute}));
import {Steam} from '../electron/steam';
afterEach(()=>{vi.restoreAllMocks();execute.mockReset();});
function setup(){
 const steam=new Steam(vi.fn());
 vi.spyOn(steam,'get').mockResolvedValue({appId:'5272970',installDirectory:"D:\\Steam\\steamapps\\common\\ETC ' playtest",name:'ETC',autoSupport:'experimental'});
 execute.mockImplementation((_command,_args,_options,callback)=>callback(null,'',''));
 return steam;
}
it('closes only the selected installed Playtest executable, using a bounded graceful window close',async()=>{
 const steam=setup(),signal=new AbortController().signal;await steam.closePlaytest(123,signal);
 expect(execute).toHaveBeenCalledOnce();const [exe,args,options]=execute.mock.calls[0];
 expect(exe).toBe('powershell.exe');expect(options).toMatchObject({windowsHide:true,signal,timeout:15000});
 const script=Buffer.from(args.at(-1),'base64').toString('utf16le');
 expect(script).toContain('Get-Process -Id 123');expect(script).toMatch(/ETC '' playtest[\\/]Lyra[\\/]Binaries[\\/]Win64[\\/]LyraGame-Win64-Shipping\.exe'/);
 expect(script).toContain('Playtest process changed');expect(script).toContain('CloseMainWindow()');expect(script).toContain('WaitForExit(10000)');expect(script).not.toMatch(/Stop-Process|Kill\(/i);
});
it.each([0,-1,NaN,1.5])('rejects invalid process ID %s before launching a shell',async pid=>{
 const steam=setup();await expect(steam.closePlaytest(pid,new AbortController().signal)).rejects.toThrow();expect(execute).not.toHaveBeenCalled();
});
it('does not close a game after the pending automatic request was cancelled',async()=>{
 const steam=setup(),controller=new AbortController();controller.abort();await expect(steam.closePlaytest(123,controller.signal)).rejects.toThrow();expect(execute).not.toHaveBeenCalled();
});
