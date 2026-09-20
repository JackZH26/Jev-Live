param([string]$RuntimeDirectory=(Join-Path $env:LOCALAPPDATA 'JevStudioRuntime'))
$ErrorActionPreference='Stop'
$voiceRoot=[IO.Path]::GetFullPath($RuntimeDirectory)
if($voiceRoot -eq [IO.Path]::GetPathRoot($voiceRoot)){throw 'Choose a dedicated runtime directory.'}
$uv=Get-Command uv -ErrorAction Stop
$voiceEnvironment=Join-Path $voiceRoot 'melo-env'
$voicePython=Join-Path $voiceEnvironment 'Scripts\python.exe'
Write-Output '1/3 Preparing the isolated CPU voice environment'
if(-not (Test-Path -LiteralPath $voicePython)){& $uv.Source venv $voiceEnvironment --python 3.10;if($LASTEXITCODE -ne 0){throw 'Environment setup failed'}}
& $uv.Source pip install --python $voicePython torch==2.5.1 torchaudio==2.5.1 --index-url https://download.pytorch.org/whl/cpu
if($LASTEXITCODE -ne 0){throw 'CPU PyTorch setup failed'}
Write-Output '2/3 Installing pinned Melo code and Windows dictionaries'
& $uv.Source pip install --python $voicePython 'git+https://github.com/myshell-ai/MeloTTS.git@209145371cff8fc3bd60d7be902ea69cbdb7965a' torch==2.5.1+cpu torchaudio==2.5.1+cpu numpy==1.26.4 setuptools==78.1.0
if($LASTEXITCODE -ne 0){throw 'Voice dependency setup failed'}
& $uv.Source pip install --python $voicePython --target (Join-Path $voiceRoot 'voice-models\melo\ko-python') python-mecab-ko==1.3.7 python-mecab-ko-dic==2.1.1.post2
if($LASTEXITCODE -ne 0){throw 'Korean dictionary setup failed'}
Write-Output '3/3 Downloading pinned weights and checksummed dictionaries'
& $voicePython (Join-Path $PSScriptRoot 'download-melo.py') --directory (Join-Path $voiceRoot 'voice-models\melo')
if($LASTEXITCODE -ne 0){throw 'Model download failed'}
Write-Output 'Ready. Start services/local_voice.py --engine melo --port 11437 --model <runtime>/voice-models/melo with the isolated Python. Wait for /health ready=true.'
