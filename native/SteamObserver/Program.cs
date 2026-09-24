using System.Diagnostics;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
using System.Text.Json;
using System.Collections.Concurrent;
using System.Text.RegularExpressions;
using Windows.Globalization;
using Windows.Graphics.Imaging;
using Windows.Media.Ocr;

// Only the selected installation is observed. No arbitrary commands or desktop capture.
class Program
{
    [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] static extern bool GetClientRect(IntPtr h, out RECT r);
    [DllImport("user32.dll")] static extern bool ClientToScreen(IntPtr h, ref POINT p);
    [DllImport("user32.dll")] static extern bool PrintWindow(IntPtr h, IntPtr dc, uint flags);
    [DllImport("user32.dll")] static extern bool IsIconic(IntPtr h);
    [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr h);
    [DllImport("user32.dll")] static extern uint SendInput(uint count, INPUT[] inputs, int size);
    [DllImport("user32.dll")] static extern short GetAsyncKeyState(int key);
    [DllImport("user32.dll")] static extern uint MapVirtualKey(uint key, uint type);
    [DllImport("user32.dll")] static extern bool SetProcessDPIAware();
    [DllImport("user32.dll")] static extern bool SetCursorPos(int x,int y);
    [StructLayout(LayoutKind.Sequential)] struct RECT {public int Left,Top,Right,Bottom;}
    [StructLayout(LayoutKind.Sequential)] struct POINT {public int X,Y;}
    [StructLayout(LayoutKind.Sequential)] struct INPUT {public uint type; public UNION u;}
    [StructLayout(LayoutKind.Explicit)] struct UNION {[FieldOffset(0)]public MOUSE mi;[FieldOffset(0)]public KEY ki;}
    [StructLayout(LayoutKind.Sequential)] struct MOUSE {public int dx,dy;public uint data,flags,time;public UIntPtr extra;}
    [StructLayout(LayoutKind.Sequential)] struct KEY {public ushort vk,scan;public uint flags,time;public UIntPtr extra;}
    record Command(string op,long epoch=0,string action="",int duration=0,double x=0,double y=0,int processId=0,long observedAt=0);
    record LobbyTarget(IntPtr Window,int ProcessId,long ObservedAt,double X,double Y);
    static volatile LobbyTarget? lobbyTarget;
    static volatile LobbyTarget? botTarget;
    static LobbyTarget? previousBotTarget;
    static readonly object outputLock=new();
    static readonly ConcurrentQueue<Command> commands=new();
    static readonly HashSet<int> held=new();
    static volatile bool running=true;
    static IntPtr window;
    static int processId;
    static long epoch,deadline;
    static bool enabled;
    static string root="";
    static int actionCount;
    static string lastAction="";
    static void Emit(object value){lock(outputLock)Console.WriteLine(JsonSerializer.Serialize(value));}
    static bool Foreground()=>window!=IntPtr.Zero&&GetForegroundWindow()==window&&!IsIconic(window);
    static long Now()=>DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
    static void Key(int vk,bool down){var input=new INPUT{type=1,u=new UNION{ki=new KEY{scan=(ushort)MapVirtualKey((uint)vk,0),flags=8u|(down?0u:2u)}}};SendInput(1,[input],Marshal.SizeOf<INPUT>());}
    static void Mouse(uint flags,int dx=0,int dy=0){SendInput(1,[new INPUT{type=0,u=new UNION{mi=new MOUSE{flags=flags,dx=dx,dy=dy}}}],Marshal.SizeOf<INPUT>());}
    static void Release(){foreach(int vk in held){if(vk==1)Mouse(4);else Key(vk,false);}held.Clear();deadline=0;}
    static void Hold(int vk){if((GetAsyncKeyState(vk)&0x8000)!=0)return;if(vk==1)Mouse(2);else Key(vk,true);held.Add(vk);}
    static void Apply(Command c)
    {
        if(c.op=="stop"){enabled=false;epoch=Math.Max(epoch+1,c.epoch);Release();return;}
        if(c.op=="enable"){Release();epoch=c.epoch;enabled=true;return;}
        if(c.op=="focus"){if(window!=IntPtr.Zero)SetForegroundWindow(window);return;}
        // A single result-screen click, independent of gameplay input enablement.
        // Coordinates come only from this helper's fresh, unique OCR observation.
        if(c.op=="return_lobby"||c.op=="bot_match"){
            var target=c.op=="return_lobby"?lobbyTarget:botTarget;
            if(target==null||c.epoch<epoch||c.processId!=processId||target.ProcessId!=processId||target.Window!=window
                ||target.ObservedAt!=c.observedAt||Now()-target.ObservedAt>1500||!Foreground())return;
            epoch=c.epoch;lobbyTarget=null;botTarget=null;Release();
            if(!GetClientRect(window,out var rect))return;var origin=new POINT();if(!ClientToScreen(window,ref origin))return;
            SetCursorPos(origin.X+(int)(rect.Right*target.X),origin.Y+(int)(rect.Bottom*target.Y));
            if(!Foreground())return;deadline=Environment.TickCount64+60;Hold(1);
            Interlocked.Increment(ref actionCount);lastAction=c.op;return;
        }
        if(c.op!="action"||!enabled||c.epoch!=epoch||!Foreground())return;
        Release();deadline=Environment.TickCount64+Math.Clamp(c.duration,20,400);
        switch(c.action){
          case "forward":Hold(0x57);break;case "back":Hold(0x53);break;
          case "left":Mouse(1,-120,0);break;case "right":Mouse(1,120,0);break;
          case "shoot":Hold(1);break;case "reload":Hold(0x52);break;
          case "interact":Hold(0x45);break;case "jump":Hold(0x20);break;
          case "menu":
            if(c.x<0||c.x>1||c.y<0||c.y>1)break;
            GetClientRect(window,out var rect);var origin=new POINT();ClientToScreen(window,ref origin);
            SetCursorPos(origin.X+(int)(rect.Right*c.x),origin.Y+(int)(rect.Bottom*c.y));if(Foreground())Hold(1);break;
        }
        Interlocked.Increment(ref actionCount);lastAction=c.action;
    }
    static void InputLoop(){while(running){while(commands.TryDequeue(out var c))Apply(c);if(held.Count>0&&(!Foreground()||Environment.TickCount64>=deadline))Release();Thread.Sleep(10);}Release();}
    static void FindWindow(){
        if(processId!=0){try{var old=Process.GetProcessById(processId);if(!old.HasExited&&old.MainWindowHandle!=IntPtr.Zero){window=old.MainWindowHandle;return;}}catch{}}
        window=IntPtr.Zero;processId=0;
        foreach(var p in Process.GetProcesses())try{if(p.MainWindowHandle==IntPtr.Zero||p.MainModule?.FileName is not string exe)continue;
          if(Path.GetFullPath(exe).StartsWith(root,StringComparison.OrdinalIgnoreCase)&&!Path.GetFileName(exe).Contains("Helper",StringComparison.OrdinalIgnoreCase)){processId=p.Id;window=p.MainWindowHandle;break;}
        }catch{}
    }
    static async Task Main(string[] args)
    {
        if(args.Length<1||!Directory.Exists(args[0]))return;
        root=Path.GetFullPath(args[0]).TrimEnd(Path.DirectorySeparatorChar)+Path.DirectorySeparatorChar;
        SetProcessDPIAware();Console.OutputEncoding=new System.Text.UTF8Encoding(false);
        var input=new Thread(InputLoop){IsBackground=true};input.Start();
        _=Task.Run(()=>{try{string? line;while((line=Console.ReadLine())!=null){if(line.Length>4096)continue;try{var c=JsonSerializer.Deserialize<Command>(line);if(c!=null)commands.Enqueue(c);}catch{}}}finally{running=false;}});
        var ocr=OcrEngine.TryCreateFromLanguage(new Language("en-US"))??OcrEngine.TryCreateFromUserProfileLanguages();
        try{while(running){
            FindWindow();var target=window;
            if(target==IntPtr.Zero){lobbyTarget=null;Emit(new{type="observation",connected=false,timestamp=Now(),heldInputs=held.Count,controlMode=enabled?"auto":"manual"});await Task.Delay(800);continue;}
            if(IsIconic(target)){lobbyTarget=null;Emit(new{type="observation",connected=true,processId,foreground=false,timestamp=Now(),error="minimized",actionCount,lastAction,heldInputs=held.Count,controlMode=enabled?"auto":"manual"});await Task.Delay(500);continue;}
            var watch=Stopwatch.StartNew();
            try{
                GetClientRect(target,out var rect);int width=rect.Right,height=rect.Bottom;
                if(width<100||height<100||width>7680||height>4320)throw new Exception();
                using var bitmap=new Bitmap(width,height,PixelFormat.Format32bppArgb);
                using(var graphics=Graphics.FromImage(bitmap)){var dc=graphics.GetHdc();try{if(!PrintWindow(target,dc,3))throw new Exception();}finally{graphics.ReleaseHdc(dc);}}
                if(args.Length>1&&args[1]=="--capture"){bitmap.Save(args[2],ImageFormat.Png);Emit(new{type="capture",processId,width,height});break;}
                using var scaled=new Bitmap(bitmap,new Size(Math.Min(width,1280),Math.Max(1,(int)(height*Math.Min(1,1280.0/width)))));
                using var stream=new MemoryStream();scaled.Save(stream,ImageFormat.Png);stream.Position=0;
                var decoder=await BitmapDecoder.CreateAsync(stream.AsRandomAccessStream());
                using var software=await decoder.GetSoftwareBitmapAsync(BitmapPixelFormat.Bgra8,BitmapAlphaMode.Premultiplied);
                var result=ocr!=null?await ocr.RecognizeAsync(software):null;
                var lines=result?.Lines.Select(l=>new {text=l.Text,x=l.Words.Min(w=>w.BoundingRect.X)/scaled.Width,y=l.Words.Min(w=>w.BoundingRect.Y)/scaled.Height,
                    width=(l.Words.Max(w=>w.BoundingRect.Right)-l.Words.Min(w=>w.BoundingRect.Left))/scaled.Width,
                    height=(l.Words.Max(w=>w.BoundingRect.Bottom)-l.Words.Min(w=>w.BoundingRect.Top))/scaled.Height}).ToArray();
                var at=Now();
                var returns=lines?.Where(l=>Regex.IsMatch(l.text.Trim(),@"^(RETURN TO LOBBY|BACK TO LOBBY|返回大厅|返回大廳)$",RegexOptions.IgnoreCase|RegexOptions.CultureInvariant)).ToArray();
                lobbyTarget=returns?.Length==1?new LobbyTarget(target,processId,at,returns[0].x+returns[0].width/2,returns[0].y+returns[0].height/2):null;
                var bots=lines?.Where(l=>Regex.IsMatch(l.text.Trim(),@"^(BOT MATCH|人机对战|人機對戰)$",RegexOptions.IgnoreCase|RegexOptions.CultureInvariant)).ToArray();
                var candidate=bots?.Length==1?new LobbyTarget(target,processId,at,bots[0].x+bots[0].width/2,bots[0].y+bots[0].height/2):null;
                // Lobby entrance animation can move a freshly recognized button.
                // Require the same position in two successive captures before clicking.
                botTarget=candidate!=null&&previousBotTarget!=null&&candidate.ProcessId==previousBotTarget.ProcessId
                    &&at-previousBotTarget.ObservedAt<=1500&&Math.Abs(candidate.X-previousBotTarget.X)<.003&&Math.Abs(candidate.Y-previousBotTarget.Y)<.003?candidate:null;
                previousBotTarget=candidate;
                Emit(new{type="observation",connected=true,processId,foreground=Foreground(),timestamp=at,width,height,lines,lobbyReturn=lobbyTarget==null?null:new {observedAt=at},botMatch=botTarget==null?null:new {observedAt=at},ocrAvailable=ocr!=null,elapsedMs=watch.ElapsedMilliseconds,actionCount,lastAction,heldInputs=held.Count,controlMode=enabled?"auto":"manual",controlEpoch=epoch});
            }catch{lobbyTarget=null;Emit(new{type="observation",connected=true,processId,foreground=Foreground(),timestamp=Now(),error="capture_unavailable"});}
            await Task.Delay(Math.Max(50,700-(int)watch.ElapsedMilliseconds));
        }}finally{running=false;input.Join(1000);}
    }
}
