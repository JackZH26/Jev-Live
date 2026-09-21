param([string]$RuntimeDirectory='E:\JevRuntime',[switch]$CheckOnly)
$ErrorActionPreference='Stop'
$repositoryRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$releaseDirectory=Join-Path $repositoryRoot 'release'
$candidates=@(Get-ChildItem -LiteralPath $releaseDirectory -Filter 'build-info.json' -Recurse -File -ErrorAction SilentlyContinue | Sort-Object LastWriteTimeUtc -Descending)
$executable=$null
$selectedBuild=$null
foreach($candidate in $candidates){
 try {
  if($candidate.Directory.Name -ne 'resources'){continue}
  $info=Get-Content -LiteralPath $candidate.FullName -Raw | ConvertFrom-Json
  if($info.schemaVersion -ne 1 -or $info.strategySources.Count -ne 9 -or @($info.strategySources.path | Select-Object -Unique).Count -ne 9){continue}
  $valid=$true
  foreach($source in $info.strategySources){
   if($source.path -notmatch '^(electron/(etc-(autoplay|policy|tactics|recovery|bridge|map|knowledge)|game)|shared/etc)\.ts$'){$valid=$false;break}
   $sourcePath=Join-Path $repositoryRoot $source.path
   if(-not(Test-Path -LiteralPath $sourcePath) -or (Get-FileHash -LiteralPath $sourcePath -Algorithm SHA256).Hash -ne $source.sha256){$valid=$false;break}
  }
  $candidateExe=Join-Path $candidate.Directory.Parent.FullName 'JEV Studio.exe'
  if($valid -and (Test-Path -LiteralPath $candidateExe)){$executable=$candidateExe;$selectedBuild=$info;break}
 }catch{continue}
}
if(-not $executable){throw 'No packaged JEV Studio matches the current AI strategy. Build the current version with npm run pack.'}
if($CheckOnly){Write-Output "Verified AI strategy $($selectedBuild.strategyRevision): $executable";return}
# A different build shares the account profile and its single-instance lock.
$running=@(Get-Process -Name 'JEV Studio' -ErrorAction SilentlyContinue)
if($running | Where-Object {$_.Path -and $_.Path -ne $executable}){throw 'Another JEV Studio build is open. Exit it through its tray menu, then run this launcher again. No running stream was stopped.'}
function Test-LocalModelService {try {$null=Invoke-RestMethod -Uri 'http://127.0.0.1:11434/api/version' -TimeoutSec 2;return $true}catch{return $false}}
if(-not (Test-LocalModelService)) {
 & (Join-Path $PSScriptRoot 'setup-local-model.ps1') -RuntimeDirectory $RuntimeDirectory
 $deadline=(Get-Date).AddSeconds(40)
 while(-not (Test-LocalModelService)){if((Get-Date) -ge $deadline){throw 'Local model service did not become ready.'};Start-Sleep -Seconds 1}
}
$models=Invoke-RestMethod -Uri 'http://127.0.0.1:11434/api/tags' -TimeoutSec 5
if(-not ($models.models | Where-Object {$_.name -eq 'qwen3.5:4b'})){Write-Warning 'The default model is missing. Run: node scripts/pull-local-models.mjs qwen3.5:4b'}
# The desktop window is intentionally visible for the user to configure and start hosting.
Start-Process -FilePath $executable -WorkingDirectory (Split-Path $executable) -WindowStyle Normal
Write-Output 'JEV Studio opened. Select Character & Hosting to start the local host. Broadcasting is not started by this launcher.'
