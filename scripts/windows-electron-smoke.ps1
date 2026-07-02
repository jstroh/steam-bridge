[CmdletBinding()]
param(
  [ValidateSet("direct", "steam-launch", "verify", "preflight", "print-launch-options")]
  [string]$Mode = "direct",

  [string]$AppDir = "",
  [string]$ResultFile = "",
  [string]$DiagnosticDir = "",
  [int]$AppId = 480,

  [ValidateSet(
    "none",
    "dialog",
    "friends",
    "store",
    "web",
    "native-probe",
    "native-dialog",
    "native-store",
    "native-web",
    "achievement-progress",
    "achievement-unlock",
    "presenter-ready",
    "presenter-dialog",
    "presenter-dialog-auto",
    "presenter-dialog-auto-open-and-wait",
    "presenter-store",
    "presenter-store-open-and-wait",
    "presenter-web",
    "presenter-web-open-and-wait",
    "presenter-duplicate-open-guard",
    "presenter-friends",
    "presenter-friends-open-and-wait",
    "presenter-profile",
    "presenter-players",
    "presenter-community",
    "presenter-stats",
    "presenter-achievements",
    "presenter-user",
    "presenter-checkout",
    "presenter-shortcut",
    "presenter-shortcut-open-and-wait",
    "presenter-achievement-progress",
    "presenter-achievement-unlock"
  )]
  [string]$Action = "none",

  [string]$OverlayProfile = "diagnostic",
  [string]$OverlayDisableDirectComposition = "",
  [string]$WindowMode = "",
  [string]$WebUrl = "",
  [string]$WebModal = "",
  [string]$CheckoutUrl = "",
  [string]$CheckoutTransactionId = "",
  [string]$CheckoutReturnUrl = "",
  [string]$Dialog = "",
  [string]$UserDialog = "",
  [string]$ShortcutTarget = "",
  [string]$PresenterMode = "",
  [string]$AchievementName = "",
  [string]$AchievementCurrent = "",
  [string]$AchievementMax = "",
  [int]$ResultDelayMs = 8000,
  [int]$TimeoutSeconds = 90,
  [string]$ShortcutGameId = "",
  [string[]]$RequireEvent = @(),
  [switch]$RequireSteamLaunch,
  [switch]$RequireOverlayReady,
  [switch]$RequireOverlayActivated,
  [switch]$RequireNoOverlayActivation,
  [int]$RequireRestoreFocusDelayMs = -1,
  [switch]$RequireZeroManagedOverlayTiming,
  [switch]$RequireNoCrashes,
  [string]$RequireActionErrorCode = "",
  [string]$RequireActionErrorReason = "",
  [string]$RequireNativeHostUnavailableReason = "",
  [switch]$KeepOpenAfterResult
)

$ErrorActionPreference = "Stop"
$ResultPrefix = "STEAM_BRIDGE_SMOKE_RESULT "

if (-not $AppDir) {
  $scriptDir = Split-Path -Parent $PSCommandPath
  if ($scriptDir -and (Test-Path -LiteralPath (Join-Path $scriptDir "SteamBridgeSmoke.exe"))) {
    $AppDir = $scriptDir
  } else {
    $AppDir = Join-Path (Get-Location) "dist\electron-smoke\x86_64-pc-windows-msvc\SteamBridgeSmoke-win32-x64"
  }
}

if (-not $ResultFile) {
  $ResultFile = Join-Path $env:TEMP "steam-bridge-smoke-windows-direct.log"
}

if (-not $DiagnosticDir) {
  $DiagnosticDir = Join-Path $env:TEMP "steam-bridge-smoke-windows-diagnostics"
}

function Resolve-SmokeExe {
  $exe = Join-Path $AppDir "SteamBridgeSmoke.exe"
  if (-not (Test-Path -LiteralPath $exe)) {
    throw "Missing SteamBridgeSmoke.exe at $exe"
  }
  return $exe
}

function Resolve-NativeAddon {
  return (Join-Path $AppDir "resources\app\node_modules\steam-bridge\steam_bridge_native.win32-x64-msvc.node")
}

function Get-SmokeArgs {
  param([string]$LogFile, [string]$SmokeAction)

  $args = @(
    "--steam-bridge-app-id=$AppId",
    "--steam-bridge-electron-overlay-profile=$OverlayProfile",
    "--steam-bridge-smoke-autorun",
    "--steam-bridge-smoke-autorun-action=$SmokeAction",
    "--steam-bridge-smoke-autorun-result-delay-ms=$ResultDelayMs",
    "--steam-bridge-smoke-result-file=$LogFile",
    "--steam-bridge-smoke-diagnostic-dir=$DiagnosticDir"
  )

  if ($KeepOpenAfterResult) {
    $args += "--steam-bridge-smoke-keep-open-after-result"
  }
  if ($OverlayDisableDirectComposition) {
    $args += "--steam-bridge-electron-overlay-disable-direct-composition=$OverlayDisableDirectComposition"
  }
  if ($WindowMode) {
    $args += "--steam-bridge-smoke-window-mode=$WindowMode"
  }
  if ($WebUrl) {
    $args += "--steam-bridge-smoke-web-url=$WebUrl"
  }
  if ($WebModal) {
    $args += "--steam-bridge-smoke-web-modal=$WebModal"
  }
  if ($CheckoutUrl) {
    $args += "--steam-bridge-smoke-checkout-url=$CheckoutUrl"
  }
  if ($CheckoutTransactionId) {
    $args += "--steam-bridge-smoke-checkout-transaction-id=$CheckoutTransactionId"
  }
  if ($CheckoutReturnUrl) {
    $args += "--steam-bridge-smoke-checkout-return-url=$CheckoutReturnUrl"
  }
  if ($Dialog) {
    $args += "--steam-bridge-smoke-overlay-dialog=$Dialog"
  }
  if ($UserDialog) {
    $args += "--steam-bridge-smoke-user-dialog=$UserDialog"
  }
  if ($ShortcutTarget) {
    $args += "--steam-bridge-smoke-shortcut-target=$ShortcutTarget"
  }
  if ($PresenterMode) {
    $args += "--steam-bridge-smoke-presenter-mode=$PresenterMode"
  }
  if ($AchievementName) {
    $args += "--steam-bridge-smoke-achievement-name=$AchievementName"
  }
  if ($AchievementCurrent) {
    $args += "--steam-bridge-smoke-achievement-current=$AchievementCurrent"
  }
  if ($AchievementMax) {
    $args += "--steam-bridge-smoke-achievement-max=$AchievementMax"
  }

  return $args
}

function Get-LaunchOptionsLine {
  param([string]$LogFile, [string]$SmokeAction)
  return (Get-SmokeArgs -LogFile $LogFile -SmokeAction $SmokeAction) -join " "
}

function Format-FileSignatureSummary {
  param([string]$Path)

  if (-not (Test-Path -LiteralPath $Path)) {
    return [PSCustomObject]@{
      path = $Path
      exists = $false
      length = $null
      authenticodeStatus = "Missing"
      signerSubject = $null
      signerThumbprint = $null
      zoneIdentifier = $false
    }
  }

  $item = Get-Item -LiteralPath $Path
  $signature = Get-AuthenticodeSignature -LiteralPath $Path
  $zone = Get-Item -LiteralPath $Path -Stream Zone.Identifier -ErrorAction SilentlyContinue
  $signer = $signature.SignerCertificate

  return [PSCustomObject]@{
    path = $Path
    exists = $true
    length = $item.Length
    authenticodeStatus = [string]$signature.Status
    signerSubject = if ($signer) { $signer.Subject } else { $null }
    signerThumbprint = if ($signer) { $signer.Thumbprint } else { $null }
    zoneIdentifier = [bool]$zone
  }
}

function Get-AppControlPolicySummary {
  $policy = Get-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\CI\Policy" -ErrorAction SilentlyContinue
  return [PSCustomObject]@{
    verifiedAndReputablePolicyState = if ($policy) { $policy.VerifiedAndReputablePolicyState } else { $null }
  }
}

function Get-RecentCodeIntegrityEvents {
  param([string[]]$Needles)

  $events = Get-WinEvent -FilterHashtable @{
    LogName = "Microsoft-Windows-CodeIntegrity/Operational"
    StartTime = (Get-Date).AddHours(-24)
  } -MaxEvents 80 -ErrorAction SilentlyContinue

  if (-not $events) {
    return @()
  }

  $matches = @()
  foreach ($event in $events) {
    foreach ($needle in $Needles) {
      if ($needle -and $event.Message -like "*$needle*") {
        $matches += [PSCustomObject]@{
          timeCreated = $event.TimeCreated
          id = $event.Id
          message = (($event.Message -replace "\r?\n", " ") -replace "\s+", " ").Trim()
        }
        break
      }
    }
  }

  return @($matches | Select-Object -First 8)
}

function Invoke-Preflight {
  $exe = Resolve-SmokeExe
  $nativeAddon = Resolve-NativeAddon
  $policy = Get-AppControlPolicySummary
  $exeSummary = Format-FileSignatureSummary -Path $exe
  $nativeSummary = Format-FileSignatureSummary -Path $nativeAddon
  $events = Get-RecentCodeIntegrityEvents -Needles @(
    "SteamBridgeSmoke",
    "steam_bridge_native",
    [System.IO.Path]::GetFileName($nativeAddon)
  )

  Write-Host "Windows smoke preflight:"
  Write-Host ("  appDir: {0}" -f $AppDir)
  Write-Host ("  powershell: {0}" -f $PSVersionTable.PSVersion)
  Write-Host ("  verifiedAndReputablePolicyState: {0}" -f $policy.verifiedAndReputablePolicyState)
  foreach ($summary in @($exeSummary, $nativeSummary)) {
    Write-Host ("  file: {0}" -f $summary.path)
    Write-Host ("    exists: {0}" -f $summary.exists)
    Write-Host ("    length: {0}" -f $summary.length)
    Write-Host ("    authenticodeStatus: {0}" -f $summary.authenticodeStatus)
    Write-Host ("    signerSubject: {0}" -f $summary.signerSubject)
    Write-Host ("    signerThumbprint: {0}" -f $summary.signerThumbprint)
    Write-Host ("    zoneIdentifier: {0}" -f $summary.zoneIdentifier)
  }

  if ($policy.verifiedAndReputablePolicyState -eq 1 -and $nativeSummary.authenticodeStatus -ne "Valid") {
    Write-Host "  warning: Windows Smart App Control/App Control is enabled and the native addon is not Authenticode-valid."
    Write-Host "  warning: SteamAPI_Init smoke runs are expected to fail before overlay testing on this machine."
  } elseif ($policy.verifiedAndReputablePolicyState -eq 1) {
    Write-Host "  warning: Windows Smart App Control/App Control is enabled; local or unreputable signatures can still be blocked."
  }

  if ($events.Count -gt 0) {
    Write-Host "  recentCodeIntegrityEvents:"
    foreach ($event in $events) {
      Write-Host ("    [{0}] id={1} {2}" -f $event.timeCreated, $event.id, $event.message)
    }
  } else {
    Write-Host "  recentCodeIntegrityEvents: none"
  }
}

function Add-DefaultRequireEvents {
  if ($RequireEvent.Count -ne 0) {
    return
  }

  switch ($Action) {
    "dialog" {
      $script:RequireEvent = @("overlay:dialog")
      break
    }
    "presenter-ready" {
      $script:RequireEvent = @("overlay:presenter-ready")
      break
    }
    "presenter-duplicate-open-guard" {
      $script:RequireEvent = @("overlay:presenter-open-and-wait-start", "overlay:presenter-duplicate-open-guard")
      break
    }
    "presenter-shortcut" {
      $script:RequireEvent = @("overlay:presenter-shortcut-ready")
      break
    }
    "presenter-checkout" {
      if ($CheckoutUrl -or $CheckoutTransactionId) {
        $script:RequireEvent = @("overlay:presenter-open")
      } else {
        $script:RequireEvent = @("overlay:presenter-checkout-ready")
      }
      break
    }
    "presenter-achievement-progress" {
      $script:RequireEvent = @("overlay:presenter-attach", "achievement:progress")
      break
    }
    "presenter-achievement-unlock" {
      $script:RequireEvent = @("overlay:presenter-attach", "achievement:unlock")
      break
    }
    "achievement-progress" {
      $script:RequireEvent = @("achievement:progress")
      break
    }
    "achievement-unlock" {
      $script:RequireEvent = @("achievement:unlock")
      break
    }
    { $_ -like "*-open-and-wait" } {
      $script:RequireEvent = @("overlay:presenter-open-and-wait-start")
      break
    }
    { $_ -like "presenter-*" } {
      $script:RequireEvent = @("overlay:presenter-open")
      break
    }
  }
}

function Wait-ForResultFile {
  param([string]$LogFile)

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    if ((Test-Path -LiteralPath $LogFile) -and (Get-Item -LiteralPath $LogFile).Length -gt 0) {
      return
    }
    Start-Sleep -Milliseconds 500
  }

  throw "Timed out waiting for smoke result file $LogFile"
}

function Read-SmokeResult {
  param([string]$LogFile)

  if (-not (Test-Path -LiteralPath $LogFile)) {
    throw "Missing smoke result file $LogFile"
  }

  $line = Get-Content -LiteralPath $LogFile |
    Where-Object { $_.StartsWith($ResultPrefix) } |
    Select-Object -Last 1

  if (-not $line) {
    throw "Missing $($ResultPrefix.Trim()) line in $LogFile"
  }

  return ($line.Substring($ResultPrefix.Length) | ConvertFrom-Json)
}

function Read-OkValue {
  param($Entry)
  if ($Entry -and $Entry.ok -eq $true) {
    return $Entry.value
  }
  return $null
}

function Test-OverlayActiveEvent {
  param($Event)

  if (-not $Event -or $Event.type -ne "callback:overlay-activated") {
    return $false
  }

  $payload = $Event.payload
  if ($payload -eq $true -or $payload -eq 1) {
    return $true
  }
  if (-not $payload) {
    return $false
  }

  $activePayload = $payload
  if ($payload.PSObject.Properties.Name -contains "0" -and $payload."0") {
    $activePayload = $payload."0"
  }

  return (
    $activePayload.active -eq $true -or
    $activePayload.active -eq 1 -or
    $activePayload.m_bActive -eq $true -or
    $activePayload.m_bActive -eq 1
  )
}

function Assert-SmokeResult {
  param($Result)

  $failures = New-Object System.Collections.Generic.List[string]
  $snapshot = $Result.snapshot
  $steam = $snapshot.steam
  $app = $snapshot.app
  $launch = $snapshot.launch
  $processInfo = $snapshot.process
  $overlay = $snapshot.overlay
  $crashDiagnostics = $snapshot.crashDiagnostics
  $nativePresenter = Read-OkValue $overlay.nativePresenter
  $electronOverlay = if ($nativePresenter) { $nativePresenter.electronOverlay } else { $null }
  $events = @($snapshot.events)
  $overlayActivated = @($events | Where-Object { Test-OverlayActiveEvent $_ }).Count -gt 0
  $expectedActionError = ($RequireActionErrorCode -or $RequireActionErrorReason)

  if ($expectedActionError) {
    if ($Result.ok -ne $false) {
      $failures.Add("smoke result failed with expected action error")
    }
  } elseif ($Result.ok -ne $true) {
    $failures.Add("smoke result ok")
  }
  if ($steam.initialized -ne $true) {
    $failures.Add("Steam initialized")
  }
  if ((Read-OkValue $steam.running) -ne $true) {
    $failures.Add("Steam running")
  }
  if ((Read-OkValue $steam.appId) -ne $app.appId) {
    $failures.Add("Steam App ID matches app config")
  }
  if ($app.appId -ne $AppId) {
    $failures.Add("app ID is $AppId")
  }
  if ($processInfo.platform -ne "win32") {
    $failures.Add("platform is win32")
  }
  if ($processInfo.arch -ne "x64") {
    $failures.Add("arch is x64")
  }
  if ($Result.action.action -ne $Action) {
    $failures.Add("autorun action is $Action")
  }
  if ($expectedActionError) {
    if ($Result.action.ok -ne $false) {
      $failures.Add("autorun action $Action failed with expected error")
    }
    if (-not $Result.action.error) {
      $failures.Add("autorun action error is serialized")
    } else {
      if ($RequireActionErrorCode -and $Result.action.error.code -ne $RequireActionErrorCode) {
        $failures.Add("autorun action error code is $RequireActionErrorCode")
      }
      if ($RequireActionErrorReason -and $Result.action.error.reason -ne $RequireActionErrorReason) {
        $failures.Add("autorun action error reason is $RequireActionErrorReason")
      }
    }
  } elseif ($Result.action.ok -ne $true) {
    $failures.Add("autorun action $Action succeeded")
  }
  if ($RequireNativeHostUnavailableReason) {
    if (-not $nativePresenter) {
      $failures.Add("native presenter snapshot available")
    } else {
      if ($nativePresenter.nativeHostUnavailableReason -ne $RequireNativeHostUnavailableReason) {
        $failures.Add("native host unavailable reason is $RequireNativeHostUnavailableReason")
      }
      if ($nativePresenter.attached -ne $false) {
        $failures.Add("native presenter is not attached while host is unavailable")
      }
      if ($nativePresenter.nativeHostOpen -ne $false) {
        $failures.Add("native presenter host is closed while unavailable")
      }
      if ($nativePresenter.currentFps -ne 0) {
        $failures.Add("native presenter current FPS is zero while unavailable")
      }
      $environmentMatches = $true
      if ($RequireNativeHostUnavailableReason -eq "macos-screen-locked") {
        $environmentMatches = $nativePresenter.macOverlayEnvironment.screenLocked -eq $true
      } elseif ($RequireNativeHostUnavailableReason -eq "macos-display-asleep") {
        $environmentMatches = (
          $nativePresenter.macOverlayEnvironment.screenLocked -eq $false -and
          $nativePresenter.macOverlayEnvironment.displayAsleep -eq $true
        )
      }
      if (-not $environmentMatches) {
        $failures.Add("mac overlay environment matches $RequireNativeHostUnavailableReason")
      }
    }
  }
  if ($RequireRestoreFocusDelayMs -ge 0) {
    if (-not $electronOverlay) {
      $failures.Add("managed Electron overlay diagnostics available")
    } elseif ($electronOverlay.restoreFocusDelayMs -ne $RequireRestoreFocusDelayMs) {
      $failures.Add("managed Electron overlay restore focus delay is ${RequireRestoreFocusDelayMs}ms")
    }
  }
  if ($RequireZeroManagedOverlayTiming) {
    if (-not $electronOverlay) {
      $failures.Add("managed Electron overlay diagnostics available")
    } else {
      if ($electronOverlay.restoreFocusDelayMs -ne 0) {
        $failures.Add("managed Electron overlay restore focus delay is zero")
      }
      if ($electronOverlay.activationBoostMs -ne 0) {
        $failures.Add("managed Electron overlay activation boost is zero")
      }
      if ($electronOverlay.activeGraceMs -ne 0) {
        $failures.Add("managed Electron overlay active grace is zero")
      }
    }
  }
  if ($RequireSteamLaunch -and $launch.steamLaunch -ne $true) {
    $failures.Add("Steam launch marker detected")
  }
  if ($RequireOverlayReady) {
    if ((Read-OkValue $steam.overlayEnabled) -ne $true) {
      $failures.Add("overlay enabled")
    }
    if ((Read-OkValue $steam.overlayNeedsPresent) -ne $false -and -not $overlayActivated) {
      $failures.Add("overlay does not need present or emitted active overlay callback")
    }
  }
  if ($RequireOverlayActivated -and -not $overlayActivated) {
    $failures.Add("overlay activation callback active=true emitted")
  }
  if ($RequireNoOverlayActivation -and $overlayActivated) {
    $failures.Add("overlay activation callback active=true was not emitted")
  }
  foreach ($eventType in $RequireEvent) {
    if (-not ($events | Where-Object { $_.type -eq $eventType } | Select-Object -First 1)) {
      $failures.Add("event $eventType emitted")
    }
  }
  if ($RequireNoCrashes) {
    if (-not $crashDiagnostics) {
      $failures.Add("crash diagnostics available")
    } else {
      $crashDumps = if ($crashDiagnostics.crashDumps) { @($crashDiagnostics.crashDumps) } else { @() }
      $fatalLifecycleEvents = if ($crashDiagnostics.fatalLifecycleEvents) { @($crashDiagnostics.fatalLifecycleEvents) } else { @() }
      if ($crashDiagnostics.available -ne $true) {
        $failures.Add("crash diagnostics available")
      }
      if ($crashDiagnostics.ok -ne $true) {
        $failures.Add("no crash diagnostics reported")
      }
      if ($crashDumps.Count -ne 0) {
        $failures.Add("no crash dumps found")
      }
      if ($fatalLifecycleEvents.Count -ne 0) {
        $failures.Add("no fatal lifecycle events recorded")
      }
    }
  }

  if ($failures.Count -gt 0) {
    if ($steam.initError -and $steam.initError.message) {
      Write-Host "Steam init error:"
      Write-Host $steam.initError.message
    }
    if ($Result.action -and $Result.action.error -and $Result.action.error.message) {
      Write-Host "Autorun action error:"
      Write-Host $Result.action.error.message
    }
    if ($RequireNoCrashes -and $crashDiagnostics) {
      Write-Host "Crash diagnostics:"
      Write-Host ($crashDiagnostics | ConvertTo-Json -Depth 8)
    }
    foreach ($failure in $failures) {
      Write-Host "Smoke result failed: $failure"
    }
    throw "Smoke verification failed."
  }

  Write-Host ("Electron smoke result verified appId={0} platform={1}/{2} overlayEnabled={3} overlayNeedsPresent={4} steamLaunch={5} action={6}" -f `
    $app.appId,
    $processInfo.platform,
    $processInfo.arch,
    (Read-OkValue $steam.overlayEnabled),
    (Read-OkValue $steam.overlayNeedsPresent),
    $launch.steamLaunch,
    $Result.action.action)
}

function Invoke-DirectSmoke {
  $exe = Resolve-SmokeExe
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $ResultFile) | Out-Null
  Remove-Item -LiteralPath $ResultFile -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $DiagnosticDir -Recurse -Force -ErrorAction SilentlyContinue

  $args = Get-SmokeArgs -LogFile $ResultFile -SmokeAction $Action
  $process = Start-Process -FilePath $exe -ArgumentList $args -WorkingDirectory $AppDir -PassThru
  if (-not $process.WaitForExit($TimeoutSeconds * 1000)) {
    Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
    throw "Timed out waiting for SteamBridgeSmoke.exe to exit."
  }

  Wait-ForResultFile -LogFile $ResultFile
  Assert-SmokeResult (Read-SmokeResult -LogFile $ResultFile)
}

function Invoke-SteamLaunchSmoke {
  if (-not $ShortcutGameId) {
    throw "Missing -ShortcutGameId for steam-launch mode."
  }

  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $ResultFile) | Out-Null
  Remove-Item -LiteralPath $ResultFile -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $DiagnosticDir -Recurse -Force -ErrorAction SilentlyContinue

  Start-Process "steam://rungameid/$ShortcutGameId"
  Wait-ForResultFile -LogFile $ResultFile
  Assert-SmokeResult (Read-SmokeResult -LogFile $ResultFile)
}

switch ($Mode) {
  "print-launch-options" {
    Write-Host "Steam shortcut launch options:"
    Write-Host (Get-LaunchOptionsLine -LogFile $ResultFile -SmokeAction $Action)
    if ($ShortcutGameId) {
      Write-Host "Launch URL: steam://rungameid/$ShortcutGameId"
    }
  }
  "preflight" {
    Invoke-Preflight
  }
  "direct" {
    Invoke-DirectSmoke
  }
  "steam-launch" {
    Add-DefaultRequireEvents
    $RequireSteamLaunch = $true
    $RequireOverlayReady = $true
    Invoke-SteamLaunchSmoke
  }
  "verify" {
    Assert-SmokeResult (Read-SmokeResult -LogFile $ResultFile)
  }
}
