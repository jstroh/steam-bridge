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
  for (const right of ["Write", "Delete", "DeleteSubdirectoriesAndFiles", "ChangePermissions", "TakeOwnership"]) {
    assert.ok(audit.includes(`[System.Security.AccessControl.FileSystemRights]::${right}`));
  }
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
    canonicalRuleCount: 4, protectedChildCount: 0, explicitChildRuleCount: 0, invalidChildRuleCount: 0 })) {
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
