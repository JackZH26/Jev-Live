param([string]$RuntimeDirectory='E:\JevRuntime',[switch]$DownloadOnly)
$ErrorActionPreference='Stop'
$runtimeRoot=[IO.Path]::GetFullPath($RuntimeDirectory)
if ($runtimeRoot -eq [IO.Path]::GetPathRoot($runtimeRoot)) { throw 'Choose a dedicated runtime directory.' }
$version='0.34.2'
$installDirectory=Join-Path $runtimeRoot "ollama-$version"
$modelDirectory=Join-Path $runtimeRoot 'models'
New-Item -ItemType Directory -Path $installDirectory,$modelDirectory -Force | Out-Null
$archive=Join-Path $runtimeRoot "ollama-$version.zip"
$executable=Join-Path $installDirectory 'ollama.exe'
if (-not (Test-Path -LiteralPath $executable)) {
 if (-not (Test-Path -LiteralPath $archive)) { & curl.exe -L --fail --retry 3 --output $archive "https://github.com/ollama/ollama/releases/download/v$version/ollama-windows-amd64.zip"; if ($LASTEXITCODE -ne 0) { throw 'Download failed' } }
 if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant() -ne '8f3fd071a2a2f9497b562f43502c77c2b701a99d1ee5dfda28da8c786373063b') { throw 'Ollama archive checksum mismatch' }
 Expand-Archive -LiteralPath $archive -DestinationPath $installDirectory -Force
}
if ($DownloadOnly) { Write-Output 'Verified portable runtime is ready'; exit }
# Environment is scoped to this script and its children; no global system changes.
$env:OLLAMA_HOST='127.0.0.1:11434'
$env:OLLAMA_MODELS=$modelDirectory
$env:OLLAMA_NO_CLOUD='1'
$env:OLLAMA_NUM_PARALLEL='1'
$env:OLLAMA_MAX_LOADED_MODELS='1'
$env:OLLAMA_MAX_QUEUE='4'
$env:OLLAMA_CONTEXT_LENGTH='4096'
$env:OLLAMA_FLASH_ATTENTION='1'
$env:OLLAMA_KV_CACHE_TYPE='q8_0'
try { $null=Invoke-RestMethod -Uri 'http://127.0.0.1:11434/api/version' -TimeoutSec 2; throw 'An Ollama server already runs on port 11434. Reuse it without changing its configuration.' } catch { if ($_.Exception.Message -like 'An Ollama*') { throw } }
Start-Process -FilePath $executable -ArgumentList 'serve' -WindowStyle Hidden -RedirectStandardOutput (Join-Path $runtimeRoot 'ollama-out.log') -RedirectStandardError (Join-Path $runtimeRoot 'ollama-error.log')
Write-Output 'Local-only Ollama server started. Models are downloaded separately.'
