param([Parameter(Mandatory=$true)][int]$CandidateProcessId)
$ErrorActionPreference='Stop'
Add-Type @'
using System;
using System.Runtime.InteropServices;
public class JevFocusEvidence {
 [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h,out uint p);
 [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
 [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
}
'@
[uint32]$frontPid=0
$window=[JevFocusEvidence]::GetForegroundWindow()
[JevFocusEvidence]::GetWindowThreadProcessId($window,[ref]$frontPid)|Out-Null
$front=Get-Process -Id $frontPid -ErrorAction SilentlyContinue
$candidate=Get-Process -Id $CandidateProcessId -ErrorAction SilentlyContinue
# Process identity only: never capture another application's title, URL or screen.
[pscustomobject]@{
 at=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
 foregroundPid=$frontPid
 foregroundName=$front.ProcessName
 candidateAlive=[bool]$candidate
 candidateWindow=if($candidate){$candidate.MainWindowHandle.ToInt64()}else{0}
 candidateMinimized=if($candidate){[JevFocusEvidence]::IsIconic($candidate.MainWindowHandle)}else{$false}
 candidateVisible=if($candidate){[JevFocusEvidence]::IsWindowVisible($candidate.MainWindowHandle)}else{$false}
}|ConvertTo-Json -Compress
