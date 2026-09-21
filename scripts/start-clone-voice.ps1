param([string]$RuntimeDirectory=(Join-Path $env:LOCALAPPDATA 'JevStudioRuntime'),[switch]$CPU)
$ErrorActionPreference='Stop'
$voiceRoot=[IO.Path]::GetFullPath($RuntimeDirectory)
$voicePython=Join-Path $voiceRoot $(if($CPU){'tts-env\Scripts\python.exe'}else{'tts-gpu-env\Scripts\python.exe'})
$voiceModel=Join-Path $voiceRoot 'voice-models\Qwen3-TTS-0.6B-Base'
$voiceService=Join-Path (Split-Path $PSScriptRoot) 'services\local_voice.py'
if(-not (Test-Path -LiteralPath $voicePython) -or -not (Test-Path -LiteralPath (Join-Path $voiceModel 'jev-model-receipt.json'))){throw 'Run install-local-voice.ps1 -CloneVoice first, using the same RuntimeDirectory and CPU option.'}
$existing=$null
try{$existing=Invoke-RestMethod -Uri 'http://127.0.0.1:11438/health' -TimeoutSec 2}catch{}
if($existing){
 if($existing.provider -eq 'qwen3-tts-clone' -and $existing.ready){Write-Output 'The clone voice service is already ready.';return}
 throw 'Port 11438 already has a service. Wait for its warm-up or inspect it before starting another instance.'
}
$voiceLogs=Join-Path $voiceRoot 'voice-logs'
$null=New-Item -ItemType Directory -Path $voiceLogs -Force
$stamp=Get-Date -Format 'yyyyMMdd-HHmmss'
$device=if($CPU){'cpu'}else{'cuda:0'}
$process=Start-Process -FilePath $voicePython -ArgumentList @('-u',('"'+$voiceService+'"'),'--engine','qwen-clone','--model',('"'+$voiceModel+'"'),'--device',$device,'--port','11438') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $voiceLogs "$stamp.out.log") -RedirectStandardError (Join-Path $voiceLogs "$stamp.err.log") -PassThru
Write-Output "Clone voice service is warming up (PID $($process.Id)). Import an English reference in Character & Hosting, then preview each language."
