[CmdletBinding()]
param(
  [ValidateSet("direct", "steam-launch", "verify", "print-launch-options")]
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
    "presenter-dialog",
    "presenter-dialog-auto",
    "presenter-dialog-auto-open-and-wait",
    "presenter-store",
    "presenter-store-open-and-wait",
    "presenter-web",
    "presenter-web-open-and-wait",
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
    "presenter-achievement-progress",
    "presenter-achievement-unlock"
  )]
  [string]$Action = "none",

  [string]$OverlayProfile = "diagnostic",
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
  [string]$RequireActionErrorCode = "",
  [string]$RequireActionErrorReason = "",
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

function Add-DefaultRequireEvents {
  if ($RequireEvent.Count -ne 0) {
    return
  }

  switch ($Action) {
    "dialog" {
      $script:RequireEvent = @("overlay:dialog")
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

  return ($line.Substring($ResultPrefix.Length) | ConvertFrom-Json -Depth 100)
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
  foreach ($eventType in $RequireEvent) {
    if (-not ($events | Where-Object { $_.type -eq $eventType } | Select-Object -First 1)) {
      $failures.Add("event $eventType emitted")
    }
  }

  if ($failures.Count -gt 0) {
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
