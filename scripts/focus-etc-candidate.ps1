param([int]$SmokeProcessId,[string]$ExpectedExe)
$ErrorActionPreference='Stop'
$smoke=Get-Process -Id $SmokeProcessId
if($smoke.Path -ne $ExpectedExe){throw 'Unexpected candidate process'}
Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class JevCandidateFocus { [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow(); [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h,out uint id); [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId(); [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint a,uint b,bool join); [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h); [DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr h); [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr h,int n); }'
[uint32]$focusProcessId=0
$focusThread=[JevCandidateFocus]::GetWindowThreadProcessId([JevCandidateFocus]::GetForegroundWindow(),[ref]$focusProcessId)
$thread=[JevCandidateFocus]::GetCurrentThreadId()
$joined=[JevCandidateFocus]::AttachThreadInput($thread,$focusThread,$true)
try {
 [JevCandidateFocus]::ShowWindowAsync($smoke.MainWindowHandle,9)|Out-Null
 [JevCandidateFocus]::BringWindowToTop($smoke.MainWindowHandle)|Out-Null
 [JevCandidateFocus]::SetForegroundWindow($smoke.MainWindowHandle)|Out-Null
} finally {if($joined){[JevCandidateFocus]::AttachThreadInput($thread,$focusThread,$false)|Out-Null}}
