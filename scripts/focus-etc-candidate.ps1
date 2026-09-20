param([int]$SmokeProcessId,[string]$ExpectedExe)
$ErrorActionPreference='Stop'
$smoke=Get-Process -Id $SmokeProcessId
if($smoke.Path -ne $ExpectedExe){throw 'Unexpected candidate process'}
if ($smoke.MainWindowHandle -eq [IntPtr]::Zero) { throw 'Candidate window not ready' }
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public class JevCandidateFocus {
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern bool SetWindowText(IntPtr h,string t);
 [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h,out uint id);
 [DllImport("kernel32.dll")] static extern uint GetCurrentThreadId();
 [DllImport("user32.dll")] static extern bool AttachThreadInput(uint a,uint b,bool join);
 [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr h);
 [DllImport("user32.dll")] static extern bool BringWindowToTop(IntPtr h);
 [DllImport("user32.dll")] static extern bool ShowWindowAsync(IntPtr h,int n);
 public static bool Activate(IntPtr h) {
  SetWindowText(h,"JEV Hybrid Acceptance"); uint ignored;
  uint current=GetCurrentThreadId(),front=GetWindowThreadProcessId(GetForegroundWindow(),out ignored),target=GetWindowThreadProcessId(h,out ignored);
  bool a=false,b=false;
  try { if(front!=0&&front!=current)a=AttachThreadInput(current,front,true);if(target!=current&&target!=front)b=AttachThreadInput(current,target,true);
   ShowWindowAsync(h,9);BringWindowToTop(h);SetForegroundWindow(h);return GetForegroundWindow()==h;
  } finally {if(b)AttachThreadInput(current,target,false);if(a)AttachThreadInput(current,front,false);}
 }
}
'@
if(-not [JevCandidateFocus]::Activate($smoke.MainWindowHandle)){throw 'Candidate foreground activation denied'}
