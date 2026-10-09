const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const filename = path.resolve(__dirname, "../scripts/windows-protect-release-candidate.ps1");
const source = fs.readFileSync(filename, "utf8");
const deploymentFilename = path.resolve(__dirname, "../scripts/windows-deploy-release-candidate.ps1");
const deploymentSource = fs.readFileSync(deploymentFilename, "utf8");
const section = name => {
  const start = source.indexOf(`function ${name} {`);
  assert.ok(start >= 0);
  const end = source.indexOf("\nfunction ", start + 1);
  return source.slice(start, end < 0 ? source.length : end);
};
const deploymentSection = name => {
  const start = deploymentSource.indexOf(`function ${name} {`);
  assert.ok(start >= 0, `Missing deployment function ${name}`);
  const end = deploymentSource.indexOf("\nfunction ", start + 1);
  return deploymentSource.slice(start, end < 0 ? deploymentSource.length : end);
};

test("deployment elevation keeps the current PowerShell edition and never supplies a policy override", () => {
  const argumentsSource = deploymentSection("Get-DeploymentArguments");
  assert.doesNotMatch(argumentsSource, /ExecutionPolicy|Bypass|Unrestricted/);
  assert.match(deploymentSource, /\$powershellPath = Get-DeploymentHostPath -RuntimeHome \$PSHOME -Edition \$PSVersionTable\.PSEdition/);
  assert.match(deploymentSource, /-Verb RunAs -WindowStyle Hidden/);
});

test("deployment host selection rejects unknown editions rather than choosing another runtime", () => {
  const selection = deploymentSection("Get-DeploymentHostPath");
  assert.match(selection, /\"Core\".*\"pwsh\.exe\"/);
  assert.match(selection, /\"Desktop\".*\"powershell\.exe\"/);
  assert.match(selection, /throw \"Unsupported PowerShell edition/);
  assert.doesNotMatch(selection, /Get-Command|SystemRoot|Start-Process|Test-Path|SilentlyContinue/);
});

test("deployment protection subprocess preserves the host and respects its existing policy", () => {
  const protection = deploymentSection("Invoke-CandidateProtection");
  assert.match(protection, /\$protectionHost = Get-DeploymentHostPath -RuntimeHome \$PSHOME -Edition \$PSVersionTable\.PSEdition/);
  assert.match(protection, /& \$protectionHost -NoProfile -NonInteractive -File \$ProtectionScript/);
  assert.doesNotMatch(deploymentSource, /ExecutionPolicy|Bypass|Unrestricted|& powershell\.exe/);
  assert.match(protection, /if \(\$LASTEXITCODE -ne 0\)/);
  assert.match(protection, /Test-CandidateProtectionRecord -Value \$result/);
});

test("Windows executes only the pure deployment host and argument builders without elevation or file actions", { skip: process.platform !== "win32" }, () => {
  const pure = ["ConvertTo-NativeArgument", "Get-DeploymentHostPath", "Get-DeploymentArguments"].map(deploymentSection).join("\n");
  assert.doesNotMatch(pure, /Start-Process|Set-ExecutionPolicy|Copy-Item|Move-Item|Remove-Item|Invoke-Candidate|Get-CimInstance/);
  const command = [
    "$ErrorActionPreference='Stop';",
    pure,
    "$core=Get-DeploymentHostPath -RuntimeHome 'C:\\Runtime Core' -Edition 'Core';",
    "$desktop=Get-DeploymentHostPath -RuntimeHome 'C:\\Runtime Desktop' -Edition 'Desktop';",
    "$unknownRejected=$false; try { Get-DeploymentHostPath -RuntimeHome 'C:\\Runtime' -Edition 'Unknown' | Out-Null } catch { $unknownRejected=$true };",
    "$SourceDirectory='C:\\QA Source'; $ActiveDirectory='C:\\QA Active'; $AuditManifest='C:\\QA Evidence\\audit.json'; $EvidenceDirectory='C:\\QA Evidence';",
    "$RollbackDirectory='C:\\QA Rollback'; $NodeExecutable='C:\\Runtime\\node.exe';",
    "$arguments=@(Get-DeploymentArguments);",
    "@{core=$core;desktop=$desktop;unknownRejected=$unknownRejected;arguments=$arguments} | ConvertTo-Json -Depth 3 -Compress;",
  ].join("\n");
  const shell = path.join(process.env.SystemRoot, "System32/WindowsPowerShell/v1.0/powershell.exe");
  const result = spawnSync(shell, ["-NoProfile", "-NonInteractive", "-Command", command], {
    encoding: "utf8", shell: false, windowsHide: true, timeout: 20000, maxBuffer: 16384,
  });
  assert.equal(result.error, undefined); assert.equal(result.signal, null); assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  const actual = JSON.parse(result.stdout);
  assert.equal(actual.core, "C:\\Runtime Core\\pwsh.exe");
  assert.equal(actual.desktop, "C:\\Runtime Desktop\\powershell.exe");
  assert.equal(actual.unknownRejected, true);
  assert.deepEqual(actual.arguments.slice(0, 3), ["-NoProfile", "-NonInteractive", "-File"]);
  assert.ok(!actual.arguments.some(value => /ExecutionPolicy|Bypass|Unrestricted/.test(value)));
  for (const flag of ["-SourceDirectory", "-ActiveDirectory", "-AuditManifest", "-EvidenceDirectory", "-Elevated", "-RollbackDirectory", "-NodeExecutable"]) {
    assert.equal(actual.arguments.filter(value => value === flag).length, 1);
  }
  assert.equal(actual.arguments[actual.arguments.indexOf("-SourceDirectory") + 1], '"C:\\QA Source"');
  assert.equal(actual.arguments[actual.arguments.indexOf("-NodeExecutable") + 1], "C:\\Runtime\\node.exe");
});

test("protection records require the fourth OWNER RIGHTS read-control-only rule", () => {
  const audit = section("Get-CandidateProtectionAudit");
  assert.match(audit, /\$ownerRightsSid = "S-1-3-4"/);
  assert.match(audit, /-Identity \$ownerRightsSid\s+`\s*-Rights \(\[System\.Security\.AccessControl\.FileSystemRights\]::ReadPermissions\)/);
  assert.match(audit, /\$canonicalRules = @\(\$currentRuleOk, \$systemRuleOk, \$administratorsRuleOk, \$ownerRightsRuleOk\)/);
  assert.match(audit, /\$rootRules\.Count -eq 4/);
  assert.match(audit, /schemaVersion = 2/);
  assert.match(audit, /ownerRightsReadControlOnly = \[bool\]\$ownerRightsRuleOk/);
  assert.match(audit, /namespaceAttested = \$false/);
});

test("descendants require the complete inherited rule set, not merely an empty explicit ACL", () => {
  const audit = section("Get-CandidateProtectionAudit");
  assert.match(audit, /GetAccessRules\(\$true, \$true/);
  assert.match(audit, /\$childOk = \$childRules\.Count -eq 4/);
  assert.match(audit, /\$_.IsInherited/);
  assert.match(audit, /\$_.InheritanceFlags -eq \$expectedChildInheritance/);
  assert.match(audit, /\$_.PropagationFlags -eq \[System\.Security\.AccessControl\.PropagationFlags\]::None/);
  assert.match(audit, /\$entry.PSIsContainer/);
  assert.match(audit, /\$matching\.Count -ne 1/);
  assert.match(audit, /\$invalidChildRuleCount -eq 0/);
  assert.match(audit, /Test-ReadExecuteOnlyRights -Value \$_\.FileSystemRights/);
});

test("root and descendant user rules share the exact read-execute predicate with optional synchronization only", () => {
  const exact = section("Test-ReadExecuteOnlyRights");
  assert.match(exact, /\$Value -eq \$readExecute -or \$Value -eq \(\$readExecute -bor/);
  assert.match(exact, /FileSystemRights\]::Synchronize/);
  assert.doesNotMatch(exact, /-band|disallowedRights/);
  assert.match(section("Test-CanonicalRootRule"), /Test-ReadExecuteOnlyRights -Value \$Rule\.FileSystemRights/);
  assert.match(section("Get-CandidateProtectionAudit"), /Test-ReadExecuteOnlyRights -Value \$_\.FileSystemRights/);
});

test("Windows memory-only root rules reject generic and unknown permissions", { skip: process.platform !== "win32" }, () => {
  const functions = [
    ...(source.includes("function Test-ReadExecuteOnlyRights {") ? [section("Test-ReadExecuteOnlyRights")] : []),
    section("Test-CanonicalRootRule"),
  ].join("\n");
  assert.doesNotMatch(functions, /Get-Acl|Set-Acl|Get-CimInstance|Invoke-Icacls|CreateFile|OpenWithRights|SetSecurityInfo/);
  const command = [
    "$ErrorActionPreference='Stop';",
    functions,
    "$qaReadExecute=[Security.AccessControl.FileSystemRights]::ReadAndExecute; $qaSynchronize=[Security.AccessControl.FileSystemRights]::Synchronize;",
    "function New-MemoryRule($qaRights) { [PSCustomObject]@{IdentityReference=[PSCustomObject]@{Value='S-1-5-21-111-222-333-1001'};FileSystemRights=[Security.AccessControl.FileSystemRights]$qaRights;AccessControlType=[Security.AccessControl.AccessControlType]::Allow;InheritanceFlags=([Security.AccessControl.InheritanceFlags]::ContainerInherit -bor [Security.AccessControl.InheritanceFlags]::ObjectInherit);PropagationFlags=[Security.AccessControl.PropagationFlags]::None;IsInherited=$false} };",
    "$qaValid=0;foreach($qaRights in @($qaReadExecute,($qaReadExecute -bor $qaSynchronize))){if(Test-CanonicalRootRule -Rule (New-MemoryRule $qaRights) -Identity 'S-1-5-21-111-222-333-1001' -Rights $qaReadExecute -ReadExecuteOnly){$qaValid++}};",
    "$qaRejected=0;foreach($qaExtra in @(0x116,0x10000,0x40,0x40000,0x80000,0x10000000,0x40000000,0x20000000,0x800,[int]::MinValue)){if(-not (Test-CanonicalRootRule -Rule (New-MemoryRule ($qaReadExecute -bor $qaExtra)) -Identity 'S-1-5-21-111-222-333-1001' -Rights $qaReadExecute -ReadExecuteOnly)){$qaRejected++}};",
    "@{valid=$qaValid;rejected=$qaRejected} | ConvertTo-Json -Compress;",
  ].join("\n");
  const shell = path.join(process.env.SystemRoot, "System32/WindowsPowerShell/v1.0/powershell.exe");
  const result = spawnSync(shell, ["-NoProfile", "-NonInteractive", "-Command", command], {
    encoding: "utf8", shell: false, windowsHide: true, timeout: 20000, maxBuffer: 16384,
  });
  assert.equal(result.error, undefined); assert.equal(result.signal, null); assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  assert.deepEqual(JSON.parse(result.stdout), { valid: 2, rejected: 10 });
});

test("protected root audit includes every access rule and rejects inherited root-only grants", () => {
  const boundary = section("Get-RootAclBoundary");
  const audit = section("Get-CandidateProtectionAudit");
  assert.match(boundary, /GetAccessRules\(\$true, \$true/);
  assert.match(boundary, /Where-Object \{ \$_.IsInherited \}/);
  assert.match(boundary, /\$rules\.Count -eq 4 -and \$inheritedCount -eq 0/);
  assert.match(audit, /\$rootBoundary = Get-RootAclBoundary -Acl \$rootAcl/);
  assert.match(audit, /\$rootBoundary\.ok -and/);
  assert.match(audit, /rootInheritedRuleCount = \$rootBoundary\.inheritedRuleCount/);
  assert.match(section("Invoke-SelfTest"), /\(A;ID;WD;;;WD\)/);
  assert.match(section("Invoke-SelfTest"), /Inherited root-only rule self-test failed/);
});

test("Apply is idempotent and establishes owner suppression only after descendant reset", () => {
  const apply = section("Set-CandidateProtection");
  assert.match(apply, /Get-CandidateProtectionAudit -Directory \$Directory\)\.ok\) \{\s+return/);
  assert.ok(apply.indexOf('"/reset"') < apply.indexOf('"*S-1-3-4:(OI)(CI)(RC)"'));
  assert.equal((apply.match(/\*S-1-3-4:\(OI\)\(CI\)\(RC\)/g) || []).length, 1);
  assert.doesNotMatch(apply, /SteamBridgeProtectionSelfTestRestore|SetOwner|RunAs|Highest/);
});

test("self-test recovery handles are confined to owned text fixtures and closed before deletion", () => {
  const fixture = section("Invoke-SelfTest");
  assert.ok(fixture.indexOf("IsInRole") < fixture.indexOf('New-Item -ItemType Directory'));
  assert.ok(fixture.indexOf("handle = [SteamBridgeProtectionSelfTestRestore]::OpenRecovery") < fixture.indexOf("Set-CandidateProtection -Directory $root"));
  assert.match(fixture, /OpenWithRights\(path, 0x00060000\)/);
  assert.match(fixture, /OpenWithRights\(path, 0x00040000\)/);
  assert.match(fixture, /Open\(\$root\)/);
  assert.match(fixture, /GetBaseException\(\)\.NativeErrorCode -ne 5/);
  assert.match(fixture, /owner must not be able to reopen WRITE_DAC/);
  assert.ok(fixture.indexOf("Restore($saved.handle") < fixture.indexOf("$saved.handle.Dispose()"));
  assert.ok(fixture.indexOf("$saved.handle.Dispose()") < fixture.indexOf("Remove-Item -LiteralPath $resolvedRoot"));
  assert.match(fixture, /\$restoreFailures \+= "fixture-\$restoreOrdinal\/\$phase\/\$code"/);
  assert.ok(fixture.indexOf("if ($restoreFailures.Count)") < fixture.indexOf("Remove-Item -LiteralPath $resolvedRoot"));
  assert.ok(fixture.indexOf("Owned self-test fixture remains after cleanup.") < fixture.indexOf("Windows candidate write-protection self-test passed."));
  assert.doesNotMatch(fixture, /Remove-Item[^\n]*SilentlyContinue/);
  assert.doesNotMatch(section("Set-CandidateProtection"), /\$restores|::Open/);
  assert.match(fixture, /\$resolvedRoot\.StartsWith\(\$temporaryPrefix/);
});

test("deployment requires typed schema-2 owner-right and complete four-rule protection evidence", () => {
  const start = deploymentSource.indexOf("function Test-CandidateProtectionRecord {");
  const end = deploymentSource.indexOf("\nfunction Invoke-CandidateProtection", start);
  const validation = deploymentSource.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.match(validation, /\$Value\.kind -isnot \[string\]/);
  assert.match(validation, /ownerRightsReadControlOnly/);
  assert.match(validation, /\$Value\.\$name -isnot \[bool\]/);
  assert.match(validation, /\$number -isnot \[int\].*\$number -isnot \[long\]/);
  for (const [name, count] of Object.entries({ schemaVersion: 2, rootExplicitRuleCount: 4,
    rootInheritedRuleCount: 0, canonicalRuleCount: 4, protectedChildCount: 0,
    explicitChildRuleCount: 0, invalidChildRuleCount: 0 })) {
    assert.ok(validation.includes(`${name} = ${count}`));
  }
  assert.match(deploymentSource, /if \(-not \(Test-CandidateProtectionRecord -Value \$result\)\)/);
  assert.match(deploymentSource, /Missing protection field self-test failed/);
  assert.match(deploymentSource, /Invalid protection field type self-test failed/);
  assert.match(deploymentSource, /Legacy or failed protection record self-test failed/);
  assert.match(deploymentSource, /Array protection kind self-test failed/);
  assert.match(deploymentSource, /Null protection kind self-test failed/);
});

test("Windows parses both PowerShell scripts and compiles only the recovery C# without running them", { skip: process.platform !== "win32" }, () => {
  const command = [
    "$tokens=$null; $errors=$null;",
    "[System.Management.Automation.Language.Parser]::ParseFile($env:BRIDGE_PROTECTION_SOURCE,[ref]$tokens,[ref]$errors) | Out-Null;",
    "if ($errors.Count) { throw 'PowerShell parse failed' };",
    "$errors=$null; [System.Management.Automation.Language.Parser]::ParseFile($env:BRIDGE_DEPLOYMENT_SOURCE,[ref]$tokens,[ref]$errors) | Out-Null;",
    "if ($errors.Count) { throw 'Deployment PowerShell parse failed' };",
    "$text=[IO.File]::ReadAllText($env:BRIDGE_PROTECTION_SOURCE);",
    "$match=[regex]::Match($text,'(?s)Add-Type -TypeDefinition @\"\\r?\\n(.*?)\\r?\\n\"@');",
    "if (-not $match.Success) { throw 'Recovery C# missing' };",
    "Add-Type -TypeDefinition $match.Groups[1].Value -ErrorAction Stop;",
    "'parse-and-compile-only-ok'",
  ].join(" ");
  const shell = path.join(process.env.SystemRoot, "System32/WindowsPowerShell/v1.0/powershell.exe");
  const result = spawnSync(shell, ["-NoProfile", "-NonInteractive", "-Command", command], {
    encoding: "utf8", shell: false, windowsHide: true, timeout: 20000,
    env: { ...process.env, BRIDGE_PROTECTION_SOURCE: filename, BRIDGE_DEPLOYMENT_SOURCE: deploymentFilename },
  });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "parse-and-compile-only-ok");
  assert.equal(result.stderr, "");
});
