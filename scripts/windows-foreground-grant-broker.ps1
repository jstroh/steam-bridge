[CmdletBinding()]
param(
  [string]$OutputDirectory = ""
)

$ErrorActionPreference = "Stop"

if (-not $OutputDirectory) {
  $OutputDirectory = Join-Path $env:LOCALAPPDATA "SteamBridgeSmoke\foreground-grant-broker"
}
$OutputDirectory = [System.IO.Path]::GetFullPath($OutputDirectory)
$source = Join-Path $PSScriptRoot "windows-foreground-grant-broker\SteamBridgeForegroundGrantBroker.cs"
$compiler = Join-Path $env:WINDIR "Microsoft.NET\Framework64\v4.0.30319\csc.exe"
$output = Join-Path $OutputDirectory "SteamBridgeForegroundGrantBroker.exe"

if (-not (Test-Path -LiteralPath $source -PathType Leaf)) {
  throw "Missing foreground grant broker source."
}
if (-not (Test-Path -LiteralPath $compiler -PathType Leaf)) {
  throw "Missing the Windows .NET Framework C# compiler."
}

New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
& $compiler `
  /nologo `
  /target:winexe `
  /optimize+ `
  /reference:System.dll `
  /reference:System.Core.dll `
  /reference:System.Drawing.dll `
  /reference:System.Windows.Forms.dll `
  /reference:System.Web.Extensions.dll `
  "/out:$output" `
  $source
if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $output -PathType Leaf)) {
  throw "Foreground grant broker compilation failed."
}

$hash = (Get-FileHash -LiteralPath $output -Algorithm SHA256).Hash.ToLowerInvariant()
[PSCustomObject]@{
  kind = "steam-bridge-windows-foreground-grant-broker-build"
  executable = $output
  sha256 = $hash
} | ConvertTo-Json -Depth 3
