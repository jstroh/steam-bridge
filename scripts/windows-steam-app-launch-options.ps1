param(
  [ValidateSet("inspect", "print-wrapper", "set", "restore", "self-test")]
  [string]$Mode = "inspect",

  [string]$AppDir = "",
  [string]$AppId = "",
  [string]$LocalConfig = "",
  [string]$SteamPath = "",
  [string]$SteamUserId = "",
  [string]$SmokeAppDir = "",
  [string]$SmokeExe = "",
  [string]$SmokeEnvFile = "",
  [string]$Backup = "",
  [string]$JavaScriptRunnerExe = "",
  [switch]$AllowSteamRunning
)

$ErrorActionPreference = "Stop"

function Resolve-ScriptAppDir {
  if ($AppDir) {
    return [System.IO.Path]::GetFullPath($AppDir)
  }
  return (Split-Path -Parent $PSCommandPath)
}

function Resolve-NodeLikeRunner {
  param([string]$ResolvedAppDir)

  if ($JavaScriptRunnerExe) {
    return [PSCustomObject]@{
      Command = [System.IO.Path]::GetFullPath($JavaScriptRunnerExe)
      UseElectronRunAsNode = $false
    }
  }

  $nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
  if ($nodeCommand) {
    return [PSCustomObject]@{
      Command = $nodeCommand.Source
      UseElectronRunAsNode = $false
    }
  }

  $electronRunner = Join-Path $ResolvedAppDir "SteamBridgeSmoke.exe"
  if (Test-Path -LiteralPath $electronRunner) {
    return [PSCustomObject]@{
      Command = $electronRunner
      UseElectronRunAsNode = $true
    }
  }

  throw "Could not find node.exe or packaged SteamBridgeSmoke.exe to run the launch-options helper."
}

function ConvertTo-WindowsProcessArgument {
  param([AllowNull()][string]$Argument)

  if ($null -eq $Argument) {
    return '""'
  }
  if ($Argument.Length -gt 0 -and $Argument -notmatch '[\s"]') {
    return $Argument
  }

  $result = New-Object System.Text.StringBuilder
  [void]$result.Append('"')
  $backslashes = 0
  foreach ($char in $Argument.ToCharArray()) {
    if ($char -eq '\') {
      $backslashes += 1
      continue
    }
    if ($char -eq '"') {
      if ($backslashes -gt 0) {
        [void]$result.Append(('\' * ($backslashes * 2)))
        $backslashes = 0
      }
      [void]$result.Append('\"')
      continue
    }
    if ($backslashes -gt 0) {
      [void]$result.Append(('\' * $backslashes))
      $backslashes = 0
    }
    [void]$result.Append($char)
  }
  if ($backslashes -gt 0) {
    [void]$result.Append(('\' * ($backslashes * 2)))
  }
  [void]$result.Append('"')
  return $result.ToString()
}

function Join-WindowsProcessArguments {
  param([string[]]$Arguments)

  return (($Arguments | ForEach-Object { ConvertTo-WindowsProcessArgument $_ }) -join " ")
}

function Invoke-NodeLikeScript {
  param(
    [Parameter(Mandatory = $true)]$Runner,
    [Parameter(Mandatory = $true)][string[]]$Arguments
  )

  $stdoutPath = [System.IO.Path]::GetTempFileName()
  $stderrPath = [System.IO.Path]::GetTempFileName()
  $resultPath = [System.IO.Path]::GetTempFileName()
  $electronLogPath = "$resultPath.electron.log"
  $previousElectronRunAsNode = [System.Environment]::GetEnvironmentVariable("ELECTRON_RUN_AS_NODE", "Process")
  $previousElectronLogFile = [System.Environment]::GetEnvironmentVariable("ELECTRON_LOG_FILE", "Process")
  try {
    if ($Runner.UseElectronRunAsNode) {
      [System.Environment]::SetEnvironmentVariable("ELECTRON_RUN_AS_NODE", "1", "Process")
      [System.Environment]::SetEnvironmentVariable("ELECTRON_LOG_FILE", $electronLogPath, "Process")
    }
    $runnerArguments = @($Arguments) + @("--result-file", $resultPath)
    $process = Start-Process `
      -FilePath $Runner.Command `
      -ArgumentList (Join-WindowsProcessArguments -Arguments $runnerArguments) `
      -Wait `
      -PassThru `
      -WindowStyle Hidden `
      -RedirectStandardOutput $stdoutPath `
      -RedirectStandardError $stderrPath

    if (Test-Path -LiteralPath $resultPath) {
      Get-Content -LiteralPath $resultPath -ErrorAction SilentlyContinue | ForEach-Object {
        Write-Host ([string]$_)
      }
    }
    if (Test-Path -LiteralPath $stdoutPath) {
      Get-Content -LiteralPath $stdoutPath -ErrorAction SilentlyContinue | ForEach-Object {
        Write-Host ([string]$_)
      }
    }
    if (Test-Path -LiteralPath $stderrPath) {
      Get-Content -LiteralPath $stderrPath -ErrorAction SilentlyContinue | ForEach-Object {
        [Console]::Error.WriteLine([string]$_)
      }
    }
    return $process.ExitCode
  } finally {
    [System.Environment]::SetEnvironmentVariable("ELECTRON_RUN_AS_NODE", $previousElectronRunAsNode, "Process")
    [System.Environment]::SetEnvironmentVariable("ELECTRON_LOG_FILE", $previousElectronLogFile, "Process")
    Remove-Item -LiteralPath $stdoutPath,$stderrPath,$resultPath,$electronLogPath -Force -ErrorAction SilentlyContinue
  }
}

$resolvedAppDir = Resolve-ScriptAppDir
$helper = Join-Path $resolvedAppDir "upsert-steam-app-launch-options.cjs"
if (-not (Test-Path -LiteralPath $helper)) {
  $repoHelper = Join-Path (Split-Path -Parent $PSCommandPath) "upsert-steam-app-launch-options.cjs"
  if (Test-Path -LiteralPath $repoHelper) {
    $helper = $repoHelper
  } else {
    throw "Missing upsert-steam-app-launch-options.cjs beside the Windows package."
  }
}

$args = @($helper, "--mode", $Mode)
if ($AppId) {
  $args += @("--app-id", $AppId)
}
if ($LocalConfig) {
  $args += @("--localconfig", $LocalConfig)
}
if ($SteamPath) {
  $args += @("--steam-path", $SteamPath)
}
if ($SteamUserId) {
  $args += @("--steam-user-id", $SteamUserId)
}
if ($SmokeAppDir) {
  $args += @("--smoke-app-dir", $SmokeAppDir)
} elseif ($Mode -in @("print-wrapper", "set")) {
  $args += @("--smoke-app-dir", $resolvedAppDir)
}
if ($SmokeExe) {
  $args += @("--smoke-exe", $SmokeExe)
}
if ($SmokeEnvFile) {
  $args += @("--smoke-env-file", $SmokeEnvFile)
}
if ($Backup) {
  $args += @("--backup", $Backup)
}
if ($AllowSteamRunning) {
  $args += "--allow-steam-running"
}

$runner = Resolve-NodeLikeRunner -ResolvedAppDir $resolvedAppDir
$exitCode = Invoke-NodeLikeScript -Runner $runner -Arguments $args
exit $exitCode
