param(
  [string]$AppDir = "",
  [string]$ArtifactRoot = "",
  [string[]]$MatrixArgs = @(),
  [string]$PrivateEnvFile = "",
  [string]$TaskNamePrefix = "SBOverlayMatrix",
  [int]$TimeoutSeconds = 1800,
  [int]$LogTailLines = 160,
  [switch]$KeepTask
)

$ErrorActionPreference = "Stop"

function Resolve-FullPath {
  param([string]$Path)

  if (-not $Path) {
    return ""
  }
  return [System.IO.Path]::GetFullPath($Path)
}

function Invoke-CheckedNative {
  param([string]$FilePath, [string[]]$Arguments)

  & $FilePath @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "$FilePath exited with code $LASTEXITCODE"
  }
}

function Format-RedactedMatrixArgs {
  param([string[]]$Arguments)

  $sensitiveValueFlags = @{
    "-AppId" = $true
    "-CheckoutJsonFile" = $true
    "-CheckoutReturnUrl" = $true
    "-CheckoutTransactionId" = $true
    "-CheckoutUrl" = $true
    "-InitTxnApiKeyEnv" = $true
    "-InitTxnEndpoint" = $true
    "-InitTxnRequestFile" = $true
  }

  $redacted = @()
  $redactNext = $false
  foreach ($argument in @($Arguments)) {
    if ($redactNext) {
      $redacted += "REDACTED"
      $redactNext = $false
      continue
    }

    $redacted += $argument
    if ($sensitiveValueFlags.ContainsKey($argument)) {
      $redactNext = $true
    }
  }

  return ($redacted -join " ")
}

$runId = "{0}-{1}" -f (Get-Date -Format "yyyyMMdd-HHmmss"), ([System.Guid]::NewGuid().ToString("N").Substring(0, 8))
if (-not $AppDir) {
  $AppDir = Split-Path -Parent $PSCommandPath
}
$AppDir = Resolve-FullPath $AppDir
$matrixScript = Join-Path $AppDir "windows-overlay-matrix.ps1"
if (-not (Test-Path -LiteralPath $matrixScript)) {
  throw "Missing windows-overlay-matrix.ps1 beside AppDir: $matrixScript"
}

if (-not $ArtifactRoot) {
  $ArtifactRoot = Join-Path $env:TEMP "steam-bridge-windows-overlay-task-$runId"
}
$ArtifactRoot = Resolve-FullPath $ArtifactRoot

if ($PrivateEnvFile) {
  $PrivateEnvFile = Resolve-FullPath $PrivateEnvFile
  if (-not (Test-Path -LiteralPath $PrivateEnvFile)) {
    throw "Private environment file was not found."
  }
}

$taskPrefix = if ($TaskNamePrefix) { $TaskNamePrefix } else { "SBOverlayMatrix" }
$taskPrefix = ($taskPrefix -replace "[^A-Za-z0-9_.-]", "-").Trim("-")
if (-not $taskPrefix) {
  $taskPrefix = "SBOverlayMatrix"
}
$taskName = "$taskPrefix-$runId"
if ($taskName.Length -gt 200) {
  $taskName = $taskName.Substring(0, 200)
}

$runRoot = Join-Path $env:SystemDrive "sb"
$runDir = Join-Path $runRoot $runId
New-Item -ItemType Directory -Force -Path $runDir | Out-Null

$runner = Join-Path $runDir "run.ps1"
$configPath = Join-Path $runDir "config.json"
$donePath = Join-Path $runDir "done.json"
$logPath = Join-Path $runDir "task-output.log"

$arguments = @("-AppDir", $AppDir, "-ArtifactRoot", $ArtifactRoot) + @($MatrixArgs)
$config = [PSCustomObject]@{
  matrixScript = $matrixScript
  arguments = @($arguments)
  privateEnvFile = $PrivateEnvFile
  donePath = $donePath
  logPath = $logPath
}
$config | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $configPath -Encoding UTF8

$runnerContent = @'
$ErrorActionPreference = "Stop"

function Import-PrivateEnvFile {
  param([string]$Path)

  if (-not $Path) {
    return
  }
  if (-not (Test-Path -LiteralPath $Path)) {
    throw "Private environment file was not found."
  }

  $count = 0
  foreach ($line in Get-Content -LiteralPath $Path) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith("#")) {
      continue
    }
    $equalsIndex = $trimmed.IndexOf("=")
    if ($equalsIndex -lt 1) {
      throw "Private environment file contains a line without NAME=VALUE syntax."
    }
    $name = $trimmed.Substring(0, $equalsIndex).Trim()
    $value = $trimmed.Substring($equalsIndex + 1)
    if ($name -notmatch "^[A-Za-z_][A-Za-z0-9_]*$") {
      throw "Private environment file contains an invalid environment variable name."
    }
    Set-Item -Path ("Env:{0}" -f $name) -Value $value
    $count += 1
  }
  Write-Host ("Imported private environment values: count={0}" -f $count)
}

function Convert-MatrixArgsToSplat {
  param([string[]]$Arguments)

  $splat = @{}
  for ($index = 0; $index -lt $Arguments.Count; $index += 1) {
    $argument = [string]$Arguments[$index]
    if (-not $argument.StartsWith("-")) {
      throw "Matrix arguments must use named PowerShell parameters."
    }

    $name = $argument.TrimStart("-")
    if (-not $name) {
      throw "Matrix arguments contain an empty parameter name."
    }

    $value = $true
    if ($index + 1 -lt $Arguments.Count) {
      $nextArgument = [string]$Arguments[$index + 1]
      if (-not $nextArgument.StartsWith("-")) {
        $value = $nextArgument
        $index += 1
      }
    }

    $splat[$name] = $value
  }

  return $splat
}

$configPath = Join-Path $PSScriptRoot "config.json"
$config = Get-Content -Raw -LiteralPath $configPath | ConvertFrom-Json
$exitCode = 0

Start-Transcript -LiteralPath ([string]$config.logPath) -Force | Out-Null
try {
  Import-PrivateEnvFile -Path ([string]$config.privateEnvFile)
  $matrixArguments = @($config.arguments | ForEach-Object { [string]$_ })
  $matrixSplat = Convert-MatrixArgsToSplat -Arguments $matrixArguments
  & ([string]$config.matrixScript) @matrixSplat
  if ($LASTEXITCODE -ne $null) {
    $exitCode = [int]$LASTEXITCODE
  }
} catch {
  $exitCode = 1
  Write-Host ("TASK_ERROR=" + $_.Exception.Message)
} finally {
  [PSCustomObject]@{
    exitCode = $exitCode
    artifactRoot = if ($config.arguments.Count -ge 4) { [string]$config.arguments[3] } else { "" }
    finishedAt = (Get-Date).ToString("o")
  } | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath ([string]$config.donePath) -Encoding UTF8
  Stop-Transcript | Out-Null
}

exit $exitCode
'@
Set-Content -LiteralPath $runner -Value $runnerContent -Encoding UTF8

$taskCommand = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File $runner"
Write-Host "Windows overlay interactive task:"
Write-Host ("  taskName: {0}" -f $taskName)
Write-Host ("  appDir: {0}" -f $AppDir)
Write-Host ("  artifactRoot: {0}" -f $ArtifactRoot)
Write-Host ("  privateEnvFile: {0}" -f $(if ($PrivateEnvFile) { "present" } else { "" }))
Write-Host ("  matrixArgs: {0}" -f (Format-RedactedMatrixArgs $MatrixArgs))
Write-Host ("  taskFiles: {0}" -f $runDir)

$exitCode = 0
try {
  Invoke-CheckedNative schtasks.exe @("/Create", "/TN", $taskName, "/TR", $taskCommand, "/SC", "ONCE", "/ST", "23:59", "/F", "/RL", "HIGHEST", "/IT")
  Invoke-CheckedNative schtasks.exe @("/Run", "/TN", $taskName)

  $deadline = (Get-Date).AddSeconds([Math]::Max(1, $TimeoutSeconds))
  while ((Get-Date) -lt $deadline -and -not (Test-Path -LiteralPath $donePath)) {
    Start-Sleep -Seconds 1
  }

  if (-not (Test-Path -LiteralPath $donePath)) {
    Write-Host "DONE_JSON_MISSING"
    $exitCode = 124
  } else {
    Write-Host "DONE_JSON_BEGIN"
    $doneJson = Get-Content -Raw -LiteralPath $donePath
    Write-Host $doneJson
    Write-Host "DONE_JSON_END"
    $done = $doneJson | ConvertFrom-Json
    $exitCode = [int]$done.exitCode
  }

  if (Test-Path -LiteralPath $logPath) {
    Write-Host "LOG_TAIL_BEGIN"
    Get-Content -LiteralPath $logPath -Tail ([Math]::Max(0, $LogTailLines))
    Write-Host "LOG_TAIL_END"
  }
} finally {
  if (-not $KeepTask) {
    & schtasks.exe /Delete /TN $taskName /F | Out-Null
  }
}

exit $exitCode
