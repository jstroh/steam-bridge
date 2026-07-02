[CmdletBinding()]
param(
  [ValidateSet("baseline", "managed", "full", "preflight")]
  [string]$Suite = "baseline",

  [ValidateSet("steam-launch", "direct")]
  [string]$LaunchMode = "steam-launch",

  [string]$AppDir = "",
  [string]$ArtifactRoot = "",
  [int]$AppId = 480,
  [string]$ShortcutGameId = "",
  [string]$OverlayProfile = "diagnostic",
  [string]$OverlayDisableDirectComposition = "",
  [string]$WindowMode = "windowed",
  [string]$WebUrl = "",
  [string]$Dialog = "Friends",
  [string]$ShortcutTarget = "friends",
  [string]$CheckoutTransactionId = "123456789",
  [int]$TimeoutSeconds = 120,
  [switch]$SkipNativeLoadGate
)

$ErrorActionPreference = "Stop"

if (-not $AppDir) {
  $scriptDir = Split-Path -Parent $PSCommandPath
  if ($scriptDir -and (Test-Path -LiteralPath (Join-Path $scriptDir "SteamBridgeSmoke.exe"))) {
    $AppDir = $scriptDir
  } else {
    $AppDir = Join-Path (Get-Location) "dist\electron-smoke\x86_64-pc-windows-msvc\SteamBridgeSmoke-win32-x64"
  }
}

if (-not $ArtifactRoot) {
  $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
  $ArtifactRoot = Join-Path $env:TEMP "steam-bridge-windows-overlay-matrix-$timestamp"
}

if (-not $WebUrl) {
  $WebUrl = "https://store.steampowered.com/app/$AppId/"
}

function Resolve-HelperPath {
  $helper = Join-Path $AppDir "windows-electron-smoke.ps1"
  if (-not (Test-Path -LiteralPath $helper)) {
    throw "Missing windows-electron-smoke.ps1 at $helper"
  }
  return $helper
}

function Resolve-SmokeExe {
  $exe = Join-Path $AppDir "SteamBridgeSmoke.exe"
  if (-not (Test-Path -LiteralPath $exe)) {
    throw "Missing SteamBridgeSmoke.exe at $exe"
  }
  return $exe
}

function Resolve-NativeAddon {
  return Join-Path $AppDir "resources\app\node_modules\steam-bridge\steam_bridge_native.win32-x64-msvc.node"
}

function Get-AppControlPolicyState {
  $policy = Get-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\CI\Policy" -ErrorAction SilentlyContinue
  if (-not $policy) {
    return $null
  }
  return $policy.VerifiedAndReputablePolicyState
}

function Test-NativeLoadGate {
  if ($SkipNativeLoadGate) {
    return
  }

  $nativeAddon = Resolve-NativeAddon
  if (-not (Test-Path -LiteralPath $nativeAddon)) {
    throw "Missing native addon at $nativeAddon"
  }

  $policyState = Get-AppControlPolicyState
  $signature = Get-AuthenticodeSignature -LiteralPath $nativeAddon
  if ($policyState -eq 1 -and [string]$signature.Status -ne "Valid") {
    throw (
      "Windows Smart App Control/App Control is enabled and the native addon is $($signature.Status). " +
      "Sign the package with a trusted/reputable publisher certificate or explicitly disable SAC on this development machine before running live overlay cases."
    )
  }
}

function New-Case {
  param(
    [string]$Id,
    [string]$Action,
    [string[]]$RequireEvent = @(),
    [switch]$RequireOverlayActivated,
    [switch]$RequireNoOverlayActivation,
    [string]$WebModal = "",
    [string]$DialogOverride = "",
    [string]$ShortcutTargetOverride = "",
    [string]$CheckoutTransactionIdOverride = "",
    [int]$ResultDelayMs = 8000
  )

  return [PSCustomObject]@{
    id = $Id
    action = $Action
    requireEvent = $RequireEvent
    requireOverlayActivated = [bool]$RequireOverlayActivated
    requireNoOverlayActivation = [bool]$RequireNoOverlayActivation
    webModal = $WebModal
    dialog = $DialogOverride
    shortcutTarget = $ShortcutTargetOverride
    checkoutTransactionId = $CheckoutTransactionIdOverride
    resultDelayMs = $ResultDelayMs
  }
}

function Get-MatrixCases {
  $baseline = @(
    New-Case -Id "00-none" -Action "none" -RequireNoOverlayActivation -ResultDelayMs 1200
    New-Case -Id "01-web" -Action "web" -RequireEvent @("overlay:web") -RequireOverlayActivated -WebModal "true"
    New-Case -Id "02-store" -Action "store" -RequireEvent @("overlay:store") -RequireOverlayActivated
    New-Case -Id "03-friends-dialog" -Action "friends" -RequireEvent @("overlay:dialog") -RequireOverlayActivated -DialogOverride "Friends"
    New-Case -Id "04-achievement-progress" -Action "achievement-progress" -RequireEvent @("achievement:progress") -RequireNoOverlayActivation -ResultDelayMs 2500
    New-Case -Id "05-achievement-unlock" -Action "achievement-unlock" -RequireEvent @("achievement:unlock") -RequireNoOverlayActivation -ResultDelayMs 2500
  )

  $managed = @(
    New-Case -Id "10-presenter-ready" -Action "presenter-ready" -RequireEvent @("overlay:presenter-ready") -RequireNoOverlayActivation -ResultDelayMs 1200
    New-Case -Id "11-managed-web-open-and-wait" -Action "presenter-web-open-and-wait" -RequireEvent @("overlay:presenter-open-and-wait-start") -RequireOverlayActivated -WebModal "true"
    New-Case -Id "12-managed-store-open-and-wait" -Action "presenter-store-open-and-wait" -RequireEvent @("overlay:presenter-open-and-wait-start") -RequireOverlayActivated
    New-Case -Id "13-managed-friends-open-and-wait" -Action "presenter-friends-open-and-wait" -RequireEvent @("overlay:presenter-open-and-wait-start") -RequireOverlayActivated
    New-Case -Id "14-managed-dialog-open-and-wait" -Action "presenter-dialog-auto-open-and-wait" -RequireEvent @("overlay:presenter-open-and-wait-start") -RequireOverlayActivated -DialogOverride "Friends"
    New-Case -Id "15-managed-shortcut" -Action "presenter-shortcut-open-and-wait" -RequireEvent @("overlay:presenter-open-and-wait-start") -RequireOverlayActivated -ShortcutTargetOverride $ShortcutTarget
    New-Case -Id "16-managed-checkout-route" -Action "presenter-checkout" -RequireEvent @("overlay:presenter-open") -RequireOverlayActivated -CheckoutTransactionIdOverride $CheckoutTransactionId
  )

  switch ($Suite) {
    "baseline" { return $baseline }
    "managed" { return $managed }
    "full" { return @($baseline + $managed) }
    "preflight" { return @() }
  }
}

function Invoke-Helper {
  param([string[]]$Arguments, [string]$LogFile)

  $helper = Resolve-HelperPath
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $LogFile) | Out-Null

  try {
    & powershell -NoProfile -ExecutionPolicy Bypass -File $helper @Arguments *>&1 |
      Tee-Object -FilePath $LogFile
    if ($LASTEXITCODE -ne 0) {
      throw "windows-electron-smoke.ps1 exited with code $LASTEXITCODE"
    }
  } catch {
    Write-Host ("Helper failed; output preserved at {0}" -f $LogFile)
    throw
  }
}

function Invoke-Preflight {
  $preflightDir = Join-Path $ArtifactRoot "00-preflight"
  New-Item -ItemType Directory -Force -Path $preflightDir | Out-Null
  $preflightLog = Join-Path $preflightDir "preflight.log"

  Invoke-Helper -Arguments @(
    "-Mode", "preflight",
    "-AppDir", $AppDir,
    "-AppId", "$AppId"
  ) -LogFile $preflightLog

  Test-NativeLoadGate
}

function Invoke-MatrixCase {
  param($Case)

  $caseDir = Join-Path $ArtifactRoot $Case.id
  $resultFile = Join-Path $caseDir "result.log"
  $diagnosticDir = Join-Path $caseDir "diagnostics"
  $helperLog = Join-Path $caseDir "helper.log"
  New-Item -ItemType Directory -Force -Path $caseDir | Out-Null

  $mode = if ($LaunchMode -eq "steam-launch") { "steam-launch" } else { "direct" }
  $args = @(
    "-Mode", $mode,
    "-AppDir", $AppDir,
    "-AppId", "$AppId",
    "-Action", $Case.action,
    "-ResultFile", $resultFile,
    "-DiagnosticDir", $diagnosticDir,
    "-OverlayProfile", $OverlayProfile,
    "-WindowMode", $WindowMode,
    "-WebUrl", $WebUrl,
    "-ResultDelayMs", "$($Case.resultDelayMs)",
    "-TimeoutSeconds", "$TimeoutSeconds"
  )

  if ($LaunchMode -eq "steam-launch") {
    if (-not $ShortcutGameId) {
      throw "Missing -ShortcutGameId for steam-launch matrix mode."
    }
    $args += @("-ShortcutGameId", $ShortcutGameId, "-RequireSteamLaunch")
  }
  if ($OverlayDisableDirectComposition) {
    $args += @("-OverlayDisableDirectComposition", $OverlayDisableDirectComposition)
  }
  if ($Case.webModal) {
    $args += @("-WebModal", $Case.webModal)
  }
  if ($Case.dialog) {
    $args += @("-Dialog", $Case.dialog)
  } elseif ($Dialog) {
    $args += @("-Dialog", $Dialog)
  }
  if ($Case.shortcutTarget) {
    $args += @("-ShortcutTarget", $Case.shortcutTarget)
  }
  if ($Case.checkoutTransactionId) {
    $args += @("-CheckoutTransactionId", $Case.checkoutTransactionId)
  }
  if ($Case.requireOverlayActivated) {
    $args += "-RequireOverlayActivated"
  }
  if ($Case.requireNoOverlayActivation) {
    $args += "-RequireNoOverlayActivation"
  }
  foreach ($event in $Case.requireEvent) {
    $args += @("-RequireEvent", $event)
  }
  if ($Case.action -like "presenter-*") {
    $args += "-RequireZeroManagedOverlayTiming"
  }

  Write-Host ("Running Windows overlay case {0}: {1}" -f $Case.id, $Case.action)
  Invoke-Helper -Arguments $args -LogFile $helperLog
}

Resolve-SmokeExe | Out-Null
New-Item -ItemType Directory -Force -Path $ArtifactRoot | Out-Null

Write-Host "Windows overlay matrix:"
Write-Host ("  suite: {0}" -f $Suite)
Write-Host ("  launchMode: {0}" -f $LaunchMode)
Write-Host ("  appDir: {0}" -f $AppDir)
Write-Host ("  artifactRoot: {0}" -f $ArtifactRoot)
Write-Host ("  appId: {0}" -f $AppId)
Write-Host ("  overlayProfile: {0}" -f $OverlayProfile)
Write-Host ("  disableDirectComposition: {0}" -f $OverlayDisableDirectComposition)

Invoke-Preflight

foreach ($case in Get-MatrixCases) {
  Invoke-MatrixCase -Case $case
}

Write-Host ("Windows overlay matrix passed. Artifacts: {0}" -f $ArtifactRoot)
