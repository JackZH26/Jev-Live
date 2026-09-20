param([Parameter(Mandatory=$true)][string]$Project)
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path -LiteralPath $Project).Path
if (-not (Test-Path -LiteralPath (Join-Path $root 'Lyra.uproject'))) { throw 'Select the ETC project directory.' }
$module = Join-Path $root 'Plugins\GameFeatures\EtcCore\Source\EtcCoreRuntime'
$entry = Join-Path $module 'Private\EtcCoreRuntimeModule.cpp'
$source = [IO.File]::ReadAllText($entry)
$patch = Join-Path $PSScriptRoot 'shared-controller.patch'
# Check the entire shared-code patch before copying any runtime files.
& git -C $root apply --reverse --check --ignore-space-change $patch 2>$null
$alreadyApplied = $LASTEXITCODE -eq 0
if (-not $alreadyApplied) {
    & git -C $root apply --check --ignore-space-change $patch
    if ($LASTEXITCODE -ne 0) { throw 'Shared Bot sources changed. Review shared-controller.patch before installing; no files copied.' }
    & git -C $root apply --ignore-space-change $patch
    if ($LASTEXITCODE -ne 0) { throw 'Shared Bot patch failed.' }
}
foreach ($file in @('EtcJevBridge.cpp','EtcJevBridge.h','EtcJevMotor.h','EtcJevMotorTest.cpp','EtcJevController.h','EtcJevSharedBrain.cpp')) {
    $dest = Join-Path $module ('Private\Development\' + $file)
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot $file) -Destination $dest -Force
}
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
