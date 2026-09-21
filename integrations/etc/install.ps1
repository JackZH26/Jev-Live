param([Parameter(Mandatory=$true)][string]$Project)
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path -LiteralPath $Project).Path
if (-not (Test-Path -LiteralPath (Join-Path $root 'Lyra.uproject'))) { throw 'Select the ETC project directory.' }
$module = Join-Path $root 'Plugins\GameFeatures\EtcCore\Source\EtcCoreRuntime'
$entry = Join-Path $module 'Private\EtcCoreRuntimeModule.cpp'
$source = [IO.File]::ReadAllText($entry)
# Later patches can change the context of an earlier one. Normalize a temporary
# copy from newest to oldest, then validate the complete chain before any write.
$names = @('shared-controller.patch','room-control.patch','awareness.patch','pendulum-path.patch','combat-camera.patch')
$paths = @($names | ForEach-Object {
    Select-String -LiteralPath (Join-Path $PSScriptRoot $_) -Pattern '^\+\+\+ b/(.+)$' | ForEach-Object { $_.Matches[0].Groups[1].Value }
} | Sort-Object -Unique)
$scratch = Join-Path ([IO.Path]::GetTempPath()) ('JevEtcInstall-' + [guid]::NewGuid().ToString('N'))
$original = @{}
try {
    foreach ($relative in $paths) {
        $from = [IO.Path]::GetFullPath((Join-Path $root $relative))
        $to = [IO.Path]::GetFullPath((Join-Path $scratch $relative))
        if (!$from.StartsWith($module + '\', [StringComparison]::OrdinalIgnoreCase) -or !$to.StartsWith($scratch + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Patch path escaped the ETC module.' }
        $original[$relative] = (Get-FileHash -LiteralPath $from -Algorithm SHA256).Hash
        New-Item -ItemType Directory -Path (Split-Path $to) -Force | Out-Null
        Copy-Item -LiteralPath $from -Destination $to
    }
    for ($i = $names.Length - 1; $i -ge 0; --$i) {
        $patch = Join-Path $PSScriptRoot $names[$i]
        $ErrorActionPreference = 'Continue'
        & git -C $scratch apply --reverse --check --ignore-space-change $patch 2>$null
        $applied = $LASTEXITCODE -eq 0
        $ErrorActionPreference = 'Stop'
        if ($applied) {
            & git -C $scratch apply --reverse --ignore-space-change $patch
            if ($LASTEXITCODE -ne 0) { throw 'Temporary patch normalization failed; no source files copied.' }
        }
    }
    foreach ($name in $names) {
        $patch = Join-Path $PSScriptRoot $name
        & git -C $scratch apply --check --ignore-space-change $patch
        if ($LASTEXITCODE -ne 0) { throw "ETC sources changed. Review $name before installing; no files copied." }
        & git -C $scratch apply --ignore-space-change $patch
        if ($LASTEXITCODE -ne 0) { throw 'Temporary patch application failed; no source files copied.' }
    }
    foreach ($relative in $paths) {
        if ((Get-FileHash -LiteralPath (Join-Path $root $relative) -Algorithm SHA256).Hash -ne $original[$relative]) { throw 'ETC source changed during preflight; no files copied.' }
    }
    foreach ($relative in $paths) {
        $from = Join-Path $scratch $relative
        if ((Get-FileHash -LiteralPath $from -Algorithm SHA256).Hash -ne $original[$relative]) { Copy-Item -LiteralPath $from -Destination (Join-Path $root $relative) -Force }
    }
} finally {
    $resolvedScratch = [IO.Path]::GetFullPath($scratch)
    $tempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\') + '\'
    if ($resolvedScratch.StartsWith($tempRoot, [StringComparison]::OrdinalIgnoreCase) -and (Split-Path $resolvedScratch -Leaf) -match '^JevEtcInstall-[a-f0-9]{32}$' -and (Test-Path -LiteralPath $resolvedScratch)) { Remove-Item -LiteralPath $resolvedScratch -Recurse -Force }
}
New-Item -ItemType Directory -Path (Join-Path $module 'Private\Development') -Force | Out-Null
foreach ($file in @('EtcJevBridge.cpp','EtcJevBridge.h','EtcJevMotor.h','EtcJevMotorTest.cpp','EtcJevController.h','EtcJevSharedBrain.cpp')) {
    $dest = Join-Path $module ('Private\Development\' + $file)
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot $file) -Destination $dest -Force
}
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'EtcViewMotion.h') -Destination (Join-Path $module 'Public\AI\EtcViewMotion.h') -Force
New-Item -ItemType Directory -Path (Join-Path $module 'Private\Tests') -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'EtcViewMotionTest.cpp') -Destination (Join-Path $module 'Private\Tests\EtcViewMotionTest.cpp') -Force
if (-not $source.Contains('#include "Development/EtcJevBridge.h"')) {
    $source = $source.Replace('#include "EtcCoreRuntimeModule.h"', "#include `"EtcCoreRuntimeModule.h`"`r`n#include `"Development/EtcJevBridge.h`"")
    $source = $source.Replace("void FEtcCoreRuntimeModule::StartupModule()`r`n{", "void FEtcCoreRuntimeModule::StartupModule()`r`n{`r`n`tEtcJevBridge::Install();")
    $source = $source.Replace("void FEtcCoreRuntimeModule::StartupModule()`n{", "void FEtcCoreRuntimeModule::StartupModule()`n{`n`tEtcJevBridge::Install();")
    $source = $source.Replace("void FEtcCoreRuntimeModule::ShutdownModule()`r`n{", "void FEtcCoreRuntimeModule::ShutdownModule()`r`n{`r`n`tEtcJevBridge::Uninstall();")
    $source = $source.Replace("void FEtcCoreRuntimeModule::ShutdownModule()`n{", "void FEtcCoreRuntimeModule::ShutdownModule()`n{`n`tEtcJevBridge::Uninstall();")
    if (-not $source.Contains('EtcJevBridge::Install();') -or -not $source.Contains('EtcJevBridge::Uninstall();')) { throw 'Module format changed. Apply the two hooks manually.' }
    [IO.File]::WriteAllText($entry, $source, [Text.UTF8Encoding]::new($false))
}
if (-not $source.Contains('EtcJevBridge::Install();') -or -not $source.Contains('EtcJevBridge::Uninstall();')) { throw 'Bridge module hooks are missing. Apply both hooks before building.' }
Write-Output 'ETC bridge installed. Build through Tools/Build.bat with the editor closed.'
