param([string]$RuntimeDirectory=(Join-Path $env:LOCALAPPDATA 'JevStudioRuntime'),[switch]$CPU,[switch]$CloneVoice)
$ErrorActionPreference='Stop'
$voiceRoot=[IO.Path]::GetFullPath($RuntimeDirectory)
if($voiceRoot -eq [IO.Path]::GetPathRoot($voiceRoot)){throw 'Choose a dedicated runtime directory.'}
$uv=Get-Command uv -ErrorAction SilentlyContinue
if(-not $uv){throw 'Install uv from https://docs.astral.sh/uv/getting-started/installation/ and run this command again.'}
$voiceEnvironment=Join-Path $voiceRoot $(if($CPU){'tts-env'}else{'tts-gpu-env'})
$voicePython=Join-Path $voiceEnvironment 'Scripts\python.exe'
$voiceModel=Join-Path $voiceRoot $(if($CloneVoice){'voice-models\Qwen3-TTS-0.6B-Base'}else{'voice-models\Qwen3-TTS-0.6B'})
Write-Output '1/3 Preparing an isolated Python 3.12 environment'
if(-not (Test-Path -LiteralPath $voicePython)){& $uv.Source venv $voiceEnvironment --python 3.12;if($LASTEXITCODE -ne 0){throw 'Python environment setup failed'}}
$torchIndex=if($CPU){'https://download.pytorch.org/whl/cpu'}else{'https://download.pytorch.org/whl/cu128'}
Write-Output '2/3 Installing pinned local speech dependencies'
& $uv.Source pip install --python $voicePython torch==2.10.0 torchaudio==2.10.0 --index-url $torchIndex
if($LASTEXITCODE -ne 0){throw 'PyTorch installation failed'}
$torchVersion=if($CPU){'2.10.0+cpu'}else{'2.10.0+cu128'}
& $uv.Source pip install --python $voicePython qwen-tts==0.1.1 transformers==4.57.3 soundfile==0.14.0 "torch==$torchVersion" "torchaudio==$torchVersion"
if($LASTEXITCODE -ne 0){throw 'Voice dependencies failed'}
Write-Output '3/3 Downloading the pinned public voice model outside the repository'
& $voicePython (Join-Path $PSScriptRoot 'download-local-voice.py') --directory $voiceModel --variant $(if($CloneVoice){'clone'}else{'custom'})
if($LASTEXITCODE -ne 0){throw 'Voice model download failed'}
Write-Output 'Ready. Start services/local_voice.py with this environment and model. Benchmark before selecting Qwen3-TTS in Studio.'
if($CloneVoice){Write-Output 'For cloned voices use --engine qwen-clone --port 11438. Import an English WAV and its exact transcript in Character & Hosting.'}
