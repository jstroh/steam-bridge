# Current Work Checkpoint

Last reviewed: 2026-10-09

This is the replace-in-place recovery checkpoint described in
[`AGENTS.md`](../../AGENTS.md). Earlier checkpoints, from the 2026-07 release
candidates through the 0.4.9 preparation, and the historical release evidence
are preserved, with private identifiers redacted, in
[checkpoint history](checkpoint-history.md).
Standing architecture decisions live in the
[presenter plan](native-overlay-presenter-plan.md).

## Active goal

Prepare a normal stable 0.4.12 release from reviewed committed main1caba46,
with the corrected schema8 publisher in the same candidate/tooling epoch.
The maintainer rejected a protected allowed-ref change; use the ordinary
v0.4.12 candidate tag and leave publishing policy unchanged. Only the root,
library and lockfile version fields change. Preserve the native controller
prototype and unrelated documentation dirt outside the source commit. Fresh
exact-source CI precedes tagging; the tag creates the normal three-target
artifacts. Its Windows version resource changes the addon bytes, so the frozen
0.4.11 Microsoft review and live evidence cannot qualify the new candidate.
Freeze and independently verify the new artifacts, then complete exact-byte
review and protected schema8 actual-game proof before gated publication.
No helper execution, consumer deployment or Steam promotion is implied.

The independently reviewed five-field version bump is committed/pushed as
1caba46bf8f873d4f8825dcf1431e509d16fefe8; only the three intended metadata
files entered that commit. All preserved prototype and unrelated evidence bytes
remain unchanged. Metadata equality, supported-target policy, zero-vulnerability
lock audit, all94 data-only package/epoch cases, seven verifier self-tests and
whitespace checks pass. Exact-source main CI37868603106 passes all nine jobs.
Normal annotated v0.4.12 was then created/pushed at that exact commit; tag
object1ae8ce9670c6e4bc8382beceb226a6f92578a964 peels to the pinned source.
Genuine tag CI37868946094 attempt1 passes all nine jobs. Independent first
checkout logs from CI job113622265479 and Release job113622265870 prove the
refs/tags/v0.4.12 fetch, peel and checkout to the exact source before dependency
setup. Release37868946050 attempt1 passes all four jobs. Downloaded original
native3-platform artifacts, matching Windows PDB and canonical Windows package
gate pass verification-only publication checks; all nine raw native/runtime
files equal the canonical89-file TGZ. The new TGZ SHA-256 is
9ab2892ee452eb69b45729e71fa12fb6c5fe37f66b2565cff91d03dba7a40be3;
the new Windows addon SHA-256 is
492bfc04e6a4330fd3542f2e32dda6d0d4eb81189eb5c2633a8d8eebfaed08bf.
Its independently verified addon/PDB debug ID is
7f294a8f-66e8-4d0d-a38f-01229ca50012-1. Source/build/package proof is complete;
the candidate remains pre-live and unqualified. Independent final artifact
review finds no discrepancy across the canonical
four file pins, exact source/tag/run/artifact provenance,89-file inventory and
all nine native files. The native-load JSON equals the audited executable probe
and remains CI-only evidence. The maintainer approved the new exact-file
Microsoft submission. The signed-in developer/SAC form is filled and the
verified addon selected; final review shows the correct file and full public
source/build/hash statement without asserting a new block. Submit has not been
clicked at the preparation observation. A subsequent fresh explicit CAPTCHA
instruction completed the same reviewed form and exact-file upload. Microsoft
now supplies a genuine accepted case and retained private exact-byte receipt;
status was Submitted with a Pending root determination and blank analyst reply.
A later bounded read observes In progress, still no analyst reply and a Pending
root determination. The automated protection cells report scan-completed icons
while their current-detection text says No malware detected; this is not an
analyst Smart App Control clearance or a whole-file malware determination.
Exact retained receipt and addon pins remain unchanged. Acceptance is not
clearance. No decision time or malware verdict is invented, and frozen0.4.11
evidence is unchanged. Fresh data-only ordinary actual-game preparation now
binds all89 canonical0.4.12 package files inside a fully verified7,890-file copy;
original runtime, game source, assets and inputs stay unchanged. It is not a
production assembly, protected launch, runtime qualification or publication.
Reuse this retained current container while exact-file review waits.
Protected schema8 four-case proof remains absent. No protected
publisher, local native candidate launch, GitHub Release or npm publication
occurred. Preserve the existing permissions, frozen0.4.11 and prototype.

The previously approved publishing-tools-0.4.11-7aac1c0 tag was already created
at exact7aac1c05d586f0525ffb595919400b1a8fad8298. Its CI37868000465 passed
all nine jobs, but it is not used for this normal release. The existing
v0.4.11 tag, Microsoft-reviewed addon and retained package remain immutable.

### Current Windows deployment host/policy correction

The normal Core-host deployment path selected a nonexistent Desktop executable
under its own runtime directory. Its two subprocess paths also supplied policy
bypasses. A pure edition-aware host builder now preserves Core/Desktop selection
for both paths without policy overrides, rejecting unknown editions. User-confirmed
elevation, hidden windows, quoting, transaction/rollback and typed ACL checks stay
unchanged. Four failing-before regressions, all eleven focused cases,105data-only
gate cases and seven verifier checks pass after correction; exact final independent
source review finds no actionable issue. No elevation, Apply, native/game launch,
candidate rebuild, tag or publication occurs. Exact committed-source CI is still
required. See [bounded source review](windows-deployment-host-policy-review-2026-10-09.json).

### Current Windows owner-right protection correction

Source review found that the three-rule ACL checker omitted the owner's
implicit permission-changing right. A read-only in-memory AccessCheck with
the current Limited token confirms that the old descriptor grants WRITE_DAC;
the added OWNER RIGHTS read-control-only rule suppresses that grant. The
tooling correction now requires four exact root/inherited rules,
effective descendant propagation, and a fresh WRITE_DAC-open denial in its
owned-text-fixture self-test. Schema2 explicitly does not attest the parent
namespace or mapped-image/module identity. The frozen tag and artifacts are
unchanged; no candidate protection or native launch occurred.

The deployment consumer also accepted only ok/writeProtected booleans from
older three-rule helpers. A separate pure validator now requires typed schema2,
four root/canonical rules, OWNER RIGHTS confirmation and valid descendants.
Its synthetic negative fixtures reject missing/type-invalid/legacy reports;
independent review also caught and corrected PowerShell array-kind admission.
The corrected consumer self-test passes its actual pure predicates and owned
activation/rollback fixture under the unchanged normal policy, with no new
fixture remaining. It exits before protection, elevation or deployment.
The frozen schema8 receipt and publisher have no ACL input; separately retained
current protection, Limited-token and namespace/image evidence still precedes
actual-game qualification. No frozen tooling epoch is silently upgraded.

Two owned-text-fixture tests failed recovery, including four direct
SetSecurityInfo access-denied results. Preserve both failed records and their
retained protected fixtures. The first prematurely printed passing line is
not whole-test success; source now prints success only after strict cleanup.
The single-factor correction adds READ_CONTROL to saved pre-protection recovery
handles only; the fresh WRITE_DAC-only denial probe, restore API/flags/order,
Limited token and execution policy remain unchanged. Independent exact-source
review and all100 data-only package/epoch/protection cases plus seven verifier
self-tests pass. A fresh normal-policy owned-text-fixture test now passes the
four-rule audit, data-write and WRITE_DAC-open denials, retained read access,
all four descriptor restores and strict cleanup. Independent absence verification
confirms its cleanup. This proves this host's recovery correction, not the API's
internal mechanism or candidate protection. Do not repeat either unchanged
failure or this unchanged passing fixture, use filesystem-incompatible
SetKernelObjectSecurity, elevate implicitly, or infer a candidate pass from
these fixtures. See `WIN-CANDIDATE-OWNER-RIGHTS-001` in the findings ledger.

Platform/type/whitespace checks pass. Full native tests and local package smoke
were not run; the local smoke route specifies an execution-policy bypass and
is not substituted for the normal-policy fixture proof. Fresh exact-committed
source CI and its Linux package-smoke gate remain required before accepting
this source-tooling slice. The seven reviewed files are now committed/pushed
as46ad717bf9ea222c3c2c2d8d8fc896b67497ffa2; remote main matches exactly.
CI37890628159 is terminal success on all nine jobs, including all three
platforms, dependency security, Linux package smoke and packed Node18/20/22/24.
Root and independent review verify the exact main-push SHA/attempt1/canonical
workflow. This is source-tooling proof, not a current protection or native/device
receipt. No candidate rebuild, retag, publication or consuming-app pin change.
The independent Windows10 source-only follow-up found one additional root-rule
predicate gap: protected inheritance does not establish absence of effective
inherited root-only permissions. The follow-up requires every root rule and
inheritedCount0, with a pure memory-descriptor negative and matching typed
deployment intake. The new source checks fail twice before correction and
all seven pass afterward. Independent exact-delta review finds no actionable
issue. One changed-audit normal-policy run passes the actual memory predicate,
canonical data/permission denials, recovery and strict fixture cleanup; the
matching deployment record/transaction fixture passes too, with no new fixture
remaining. All101 data-only cases and seven verifier self-tests pass. The six-file
follow-up is committed/pushed asab7dd320b6aaf96e0e774cbda4f6280948d55dbc;
remote main matches. CI37892675620 attempt1/main push/canonical CI is terminal
success on all nine jobs, independently confirmed, including all three platforms,
Linux package smoke, dependency security and packed Node18/20/22/24. This is not
a demonstrated NTFS bypass or passing live QA. Frozen tag/artifacts are unchanged.
Preserve unrelated native prototype/cache evidence.

### Current Windows resource-only task transport

A private consumer-QA resource prototype now passes a real current-user
InteractiveToken/LeastPrivilege on-demand task, using only the existing signed
Windows system command processor. Its actual actor is Limited/Medium in the
expected session; distinct raw stdout/stderr retain both exact sentinel byte
streams, the expected nonzero exit propagates, and the owned task is removed.
Independent source and retained-result reconciliation agrees. This is transport
proof, not candidate, game, mapped-module, device or notification qualification.

Five distinct failed prototype records remain retained: inherited Core-versus-Desktop
module selection; a candidate-only hard-link restriction incorrectly applied to
the OS resource; byte-encoding declaration versus a CIM XML string; the COM
property name versus its XML element; and exported default-field normalization.
Corrected vendor-manifest selection preserves normal authorization. The OS-only
resource read does not change candidate single-link requirements. Retained-memory
XML registration and closed actors/triggers/settings remain mandatory, with no
automatic retry or maintenance setting. Omitted XML defaults require matching
authoritative Limited/Interactive/demand-start CIM values. A never-started task
left by failed-closed validation was separately removed after exact retained-spec
and full contract checks; its original failure was not replaced or passed.

Do not repeat this unchanged resource pass or any unchanged failure. The separate
guarded actual-game adapter is still absent: helper-specific retained locks and
suspended native-image binding are building blocks only, with eleven pins,
16-MB files, one process, five seconds and 4-KB streams. Ancestor locks alone
do not freeze unpinned directory contents. Preserve helper limits and spent
results; a game route needs its own reviewed closed candidate inventory,
namespace/image/module/token/protection, account/capture and exact-file
Microsoft/SAC bindings before execution. No native candidate, installation,
notification enrollment/send, security change or publication occurred.
See `WIN-STANDALONE-RESOURCE-TRANSPORT-001` in the findings ledger.

### Superseded frozen 0.4.11 preparation

Prepared stable 0.4.11 from the corrected committed input, preload and layout
source. The QA example moves to Electron44.6.0 to satisfy current source CI;
this does not upgrade a consuming application's production runtime. Preserve
the uncommitted native Linux controller prototype but exclude its lib.rs,
native.ts and new module changes from the release commit and artifacts.
Microsoft exact-byte review precedes any consuming application's Steam release.
New native artifacts require their own review and protected candidate-bound
four-case proof; prior 0.4.10 clearance and source CI are not transferred.
The newly reviewed formatter advisory also blocks the build dependency graph.
A scoped build-only sprintf-js derivative bounds only numeric precision while
preserving Get3, global-agent3, Roarr2 and the existing cache-policy repair.
The focused62 formatter/upstream/cache checks and lock audit pass. Current
source23053a9 passes all nine CI jobs and the four-job, three-target Release
preflight, including its Windows package gate. The initial Windows run converted
the new vendor source/tests to CRLF and failed both strict raw-hash assertions;
explicit LF attributes preserve the reviewed bytes without relaxing them.
The preflight Windows addon and matching PDB are retained and their debug ID
is verified. The independently downloaded canonical tarball and retained
Windows bundle also pass the publish verifier in verification-only mode.
The earlier preflight artifacts are historical, not tag-bound Microsoft/live receipts.
The maintainer subsequently approved version0.4.11 at23053a9 and renewed the
new-candidate unsigned, exact-file Microsoft-review release exception. Immutable
v0.4.11 now resolves to that exact commit locally and remotely. Its tag CI
37586960096 passes all nine jobs; tag Release37586960092 passes all four jobs.
The retained tag Windows addon is9286656bytes, SHA-256
ea6e9c5d4d6faaa6a4d557a787131a877fe8c21658a8659750ddd39b0a4830e6.
Its matching PDB SHA-256 is
09883554c2d099fb167b8f13dba95114124c35a1c1085810554a44721fc4a38e,
with verified debug ID27200b02-a373-4857-90ad-69479108dd6c-1.
The tag canonical tarball SHA-256 is
fb3544615ef5672c506d7645969e9aeb02a3c5247e70e04ef88a7e7ebe699d6a;
its retained Windows bundle is
1d98f3cd69476ac972623b8b9aa5800fee2cf6f51b8af2b2eea1ca4bb9c62094.
Verification-only publication validation passes; it performs no local native launch.
The exact tag addon and maintainer-approved developer statement were accepted
by Microsoft's Smart App Control submission portal after the maintainer approved
the CAPTCHA step. The immutable local artifact now has a retained private upload
receipt and tracking link. History initially gained exactly one new entry, status
Submitted, final determination Pending and no analyst comment. A later analyst
response confirms that all submitted files were not blocked by Smart App Control.
That exact-file SAC review is complete despite stale generic Pending labels; it
is separate from malware-table status and protected consuming-game proof. Its
displayed SHA-256 is the developer-text echo, not an independently exposed
server-computed digest. Exact retained addon bytes remain unchanged and have not
been locally launched as this candidate.
The maintainer now authorizes publication of the frozen0.4.11 package and the
consumer dependency update, subject to the existing release gates. Fresh GitHub
metadata confirms tag Release37586960092 and CI37586960096 succeeded for23053a9.
Verification-only validation again matches the canonical tarball, retained bundle
and package audit. No matching0.4.11 schema-7 live-proof receipt was found in the
retained release evidence, and the protected publisher has no configured proof.
Earlier0.4.10 and schema-4 receipts do not bind this candidate. No publisher was
dispatched, package published, or consuming-app pin changed.
The maintainer approved an isolated Windows QA handoff for the four cases.
That host now verifies a full OS reboot and current desktop-app version, but
native capture still fails after the single permitted fresh-selection recovery.
Its ordinary application launch/window inventory works; a separately approved
desktop image is diagnostic-only, not native-controller/game proof. No further
blind reboot or unchanged capture retry is justified. A second host recovers
capture of its recorder after one supported foreground recovery; the initial
wrong-surface image is invalidated. Recording, actual game capture and every
live case remain unproved. Protected actual-game consumer/Limited-route,
executable review and cross-host Steam isolation remain prerequisites.

A data-only reproduction found that schema7's consumer check admitted altered
producer JavaScript and a missing preload when version/native3 still matched.
The local schema8 repair binds every normal-install file and exact metadata to
the canonical TGZ before and after evidence validation, then independently
recomputes that binding and reconciles native3 in configurator/publication intake.
Bounded in-memory archive inventory rejects links, portable collisions, truncated
bodies, incomplete end markers and data after EOF; no mutable extraction is used.
The copied checker includes the exact locked upstream tar bundle and license.
Its isolated synthetic self-test needs no repository dependency resolution.
The frozen0.4.11 TGZ remains89files/35925686content bytes, fingerprint
67b39b8862fa5923a8e5447dad5ee43d8b4c7bdac621f70f957924e45e407669.
This read-only inventory is not consumer verification or a live receipt.
The maintainer-approved scoped checker/tests/docs repair is pushed as449dc38,
excluding the native prototype, private artifacts and unrelated cache evidence.
Its exact-source CI37734552772 ends with Windows/macOS publisher self-test
fixtures using OS temporary-directory aliases rather than physical paths. The follow-up
canonicalizes only that owned fixture root; production link rejection stays
intact. The new cross-platform alias regression and all32 binding cases, full
data-only Windows package-gate checks and whitespace checks pass. Independent
actual-source testing reproduces the original failure and corrected success.
No local native tests, package smoke, build or new real receipt was run for this
repair. Exact-committed-source CI, including package smoke, remains a source
gate; it does not qualify a device or retrofit the frozen candidate. Linux and
dependency audit pass; package smoke stops at the latest-Electron gate because
the QA example is44.6.0 while current stable is44.7.0. A separate QA-example-only
update decision is pending; the frozen bundle and consumer runtime stay unchanged.
The reviewed fixture follow-up is pushed asaeac5cf with remote hash verified;
exact-source CI37735728865 results are recorded below. Its separate latest-
Electron failure is not permission to restart the run or transfer platform proof.
Independent review findings on archive termination and redundant consumer
payload rereads are corrected. A final independent13-case synthetic archive
matrix passes, including valid PAX/GNU long paths and empty files; no residual
actionable finding in the reviewed delta. Source anchors are binding helper
4d5d231b5573befd1088c12f76cccfbf2654a36daaa1317eff6962983668c457 and
receipt generator5f0ac9baadd708d1ed3cc395e41e9930feff65a7d9cfac530753a5d9821f9b2a.
This remains source/offline proof, not runtime qualification.
The immutable tag's generator/publisher remains schema7. Local schema8 source
does not retrofit that workflow; do not retag, replace frozen bytes, silently
reuse schema7 proof or claim publication readiness. Maintainer source/tooling
epoch reconciliation is needed before protected live qualification/publication.
See `WIN-CONSUMER-PACKAGE-BINDING-001` in the findings ledger.
CI37735728865 is now terminal: Windows, macOS, Linux and dependency audit pass;
only the separate QA-example latest-version gate fails and Node matrix is skipped.
The maintainer now explicitly approves the workflow-only split, review, commit
and push. Local corrected publication source pins immutable tooling dispatch/
workflow/checkout independently from original candidate Release/source/CI. It
checks canonical workflow/repository/ref-name/SHA/status/attempt evidence before
dependencies and artifact download, peels annotated tags and rechecks before
publication. The actual publisher additionally rejects a candidate audit whose
full source SHA differs from the explicit approved candidate pin. Source-binding
snapshots must be retained successfully before npm publication; a third fresh
continuity check follows retention. OIDC identity variables and protections are
unchanged. All62 epoch regressions and previous32 complete-package cases pass;
the actual verifier self-test rejects a mismatched source pin. Independent
same-epoch proof also passes. Independent final source/docs/retention review
finds no residual actionable defect in that delta; the original tag-ref evidence
limitation below remains open. All94 data-only tests/self-tests, three workflow/
support invariants, parsed workflow/ten-input limit and whitespace checks pass.
GitHub REST bare/short-ref metadata does not independently attest a full original
tag ref; do not turn an ambiguous same-named branch run into tag-push proof.
Genuine original event/checkout evidence remains an operational prerequisite,
as does an explicitly approved immutable tooling tag with exact-source green CI.
No environment/OIDC change, new tag, dispatch or publication occurs.
The approved ten-file source slice is now committed/pushed72f0198 and remote
main matches exactly. CI37737891233 is terminal: all three platform jobs and
dependency audit pass; only the known QA example44.6.0 versus44.7.0 latest gate
fails and the Node runtime matrix is skipped. No rerun was dispatched.
Fresh read-only original CI37586960096 and Release37586960092 checkout logs
independently show the pinned first checkout action fetching/peeling/checking
out refs/tags/v0.4.11 to exact23053a9, before repository code or dependency setup.
Root verifies Windows-check job112679214698 and package-gate job112681206675;
independent review verifies distinct security/prebuild jobs. Both original runs
are successful push/attempt1 in the canonical repository/workflows. This closes
their original checkout namespace ambiguity, not signed event, native/live
qualification or future tooling-tag proof. Frozen v0.4.11 still resolves to
23053a9. No new tag, publication or candidate bytes were created.
The maintainer subsequently approved the QA-example-only Electron44.7.0 update,
tests, commit and push. Exactly two metadata files changed: the example pin and
the lockfile's matching workspace/package version, URL and official integrity.
All other lock records, dependency shapes and library/runtime pins are unchanged.
Normal scoped dependency reconciliation with scripts disabled updates one package;
the version/latest guard, derived Windows ASAR fixture, supported-target policy,
zero-vulnerability lock audit, all94 data-only package/epoch tests and package-gate
self-tests pass. Independent review confirms exact scope and unchanged frozen
addon/TGZ/audit/helper/receipt pins. The approved two-file slice is committed/pushed
7aac1c0; remote main matches its full SHA. Unrelated prototype and documentation
hunks remain unstaged. Fresh exact-source CI37748229914 completes successfully
on all nine jobs: Windows, Apple Silicon macOS, Linux, dependency audit, full
package smoke and Node18/20/22/24. Primary watch and independent final API metadata
verify attempt1/main push/canonical CI/exact full source; Windows completes last
at08:15:30UTC. This is a new push run, not a restart of terminal earlier runs.
Local frozen native loading,
prototype builds, full native Windows package smoke and live QA were not run.
That publishing-tools tag and its successful tag-push CI now exist as recorded
above. The subsequent normal-release decision supersedes its publication path;
no protected publisher was dispatched and no package was published.
Fresh private consuming-game data preparation now provides a normal-directory
container with all 89 canonical package files. Two independent source reviews
corrected temp/privacy checks, source pinning, omitted physical dependencies and
mutable archive reads before the single preparation. Game headers/bodies derive
from one pinned archive buffer; an independent reconstruction verifies all 7,890
output files and unchanged original inputs. The runtime, game code, assets and
original metadata are unchanged; the separately bound package is 0.4.11. Two
diagnostic opt-in markers are omitted only in the copy, with other physical
dependencies preserved. This is older-game QA preparation, not current production
assembly or a passing launch. The private receipt remains unqualified and no
candidate native code has executed. Its inherited writable ACL is not a protected
boundary; exact executable/native review, scoped protection or equivalent audit,
Limited route, account isolation and control/capture still precede the four cases.
Reuse the retained prepared container rather than recreate unchanged staging.
Shipped consumer runtime and
all Microsoft-reviewed frozen bytes remain unchanged and separately unqualified.
No local native prototype build is used as release evidence. No consuming-app
deployment or Steam promotion is authorized by this publication decision.
Normal signed gates remain intact; this exception is not an Authenticode claim,
old-clearance transfer, QA-review-package promotion or security-setting bypass.

### Retained unqualified Linux controller research

A new controlled Linux discovery comparison narrows the consumer's cold first-
stick failure to an upstream virtual-device grouping defect. The actual tagged
Chromium factory gives different virtual input parents the same prefix;
`GamepadDeviceLinux::IsSameDevice` then aliases them and the last opened joydev
descriptor replaces the earlier one. An isolated actual Electron44.4.5/
Chromium152.0.7977.130 window on Deck, with Steam, Bridge and consumer code absent,
confirms loss of one of two kernel-uinput virtual controllers. Both kernel axes
change, but only one virtual browser slot remains responsive. The lost controller
works after a singleton reconnect. A display-on repeat preserves the failure;
the earlier DPMS-off sampling caveat is retained. Physical built-in input was
not actuated, and this does not qualify every consumer startup failure.

A small upstream source trial keeps virtual input parents distinct and passes
the failing-before invariant while preserving physical USB joydev/evdev/hidraw
pairing. It is not applied to a shipping runtime. Chromium main still uses the
same prefix operation; Electron44.5.1 pins the same Chromium version, so a blind
upgrade is not established as a fix. The private probe and both virtual devices
are retired; the installed consumer was untouched and Steam stayed closed.
See `LINUX-VIRTUAL-GAMEPAD-COLLISION-001` before another live admission trace.

Next repair choice is pending: an owned Linux native controller/emulation
backend, preserving exact identity, custom layouts, non-Steam browser devices,
deduplication and physical held-input quarantine, or a private patched Electron
runtime followed by a full candidate-bound retest. No runtime/source transport
is enabled by this evidence. Keep the unresolved native gameplay prototype off,
and do not change global udev rules, player bindings or browser privacy gates.

### Earlier consumer admission evidence

A fresh private consumer pass on actual Deck Game Mode admits an additive,
exact-version QA chord contract. Ordered Control/Shift/terminal bindings now
reach all fourteen action terminals, with cursorless shell/world entry,
acknowledged Menu-to-Gameplay handoff, hotbar changes, trigger-modified mirrors,
bags/top-bar entry and ordinary gameplay. Consumer and host release ownership
distinguish synthetic focus cleanup from real neutral; all-terminal offline
regressions pass. Production capability/defaults remain unchanged and the native
identity/deduplication prototype remains disabled. These results do not qualify
built-in HID, every gameplay semantic action or populated items. A subsequent
matched virtual-pad run proves one ordinary overlay held-direction quarantine
and neutral/fresh-press recovery, not the complete terminal/device matrix.

Actual stick activation admitted a standard Chromium slot and moved the world.
The earlier empty-pad observation was not a proven absent analog provider.
Admission also changed consumer prompts from ABXY to positional arrows. The
consumer repair queries exact handles only for native identities and uses
bounded standard raw-family fallbacks otherwise. Actual changed-byte Game Mode
proof identifies Valve's virtual Xbox emulator (28de:11ff), retains ABXY after
stick admission, and retains it through disconnect/reconnect with a changed
Chromium slot. Unknown/nonstandard devices remain positional. Exact identity
regressions reject unrelated Steam controllers sharing a numeric slot. Startup
SDK hints and emulator labels do not qualify underlying hardware or arbitrary
custom remapping. Never match these namespaces numerically or suppress raw pads.
See `DECK-CONSUMER-CHORD-ADMISSION-001` and `DECK-CONSUMER-PROMPT-NAMESPACE-001`.

Another confirmed generator defect inverted physical Start/Menu and Select/View.
Valve's installed templates identify button_escape as Start and button_menu as
Select. The generic generator now uses menu/view respectively, with both analog
and digital source-profile tests for all sixteen controller types. A consumer
canonicalization against its older pinned package is idempotent with this
corrected generator. Matched private revision 2.4 emits the correct physical
commands on actual Game Mode; corrected virtual X/Y helpers use kernel xpad
letter aliases rather than misleading geometric aliases. See
`INPUT-LEGACY-MENU-VIEW-001`. The library source is committed for source push;
no corrected npm package has been published or repinned.

Original installed objects, symlinks and modes were restored exactly. Owned
input, inhibitor, capture, server and debugger resources are stopped; Wayland
Desktop, closed Steam and display-on state are verified. The raw video fully
decodes, but older capture metadata lacks encoder-EOS attestation and late
markers fall outside its duration. The edited diagnostic excludes those markers
and labels a separate passive visible-world ending; it is not a release receipt.
New captures observe encoder EOS and fully decode. A short edited follow-up
uses a same-recording visible-game ending, not substituted pixels. Consumer QA
helpers now fail missing EOS and safely resume an exact interrupted restore.
No binding reset, global keymap change or publication occurred. Do not
repeat the unchanged black text-dialog experiment or suspend without a wake path.

Next consumer scope: RT still defaults to a mouse click. A new typed
selected/nearest visible NPC route reuses range/dispatch and GUI ownership. On
actual Game Mode with a private trigger-emulation layout, RT opens one nearby
NPC window after browser stick admission, stays quarantined across dialog close
while held, and reopens on neutral/repress. The first immediate RT sample had no
browser pad/action; its initialization cause is not established. Chat correctly
owns RT but exposes keyboard-emulated Back being swallowed by native text.
A matched QA-only terminal reservation now retains ignored holds until release,
and separates cleanup-only history from unreleased state. Independent held/focus/
target/history regressions pass; repaired text bytes still need device retest.
Legacy-only admission remains gated because its older reset/neutral path can
spill held input into gameplay. Shipped defaults are unchanged. The short video
preserves failures, uses a same-recording visible-world ending and fully decodes;
late markers outside the source duration are excluded. The original tree and
Desktop/closed-Steam baseline are exactly restored. See
`DECK-CONSUMER-CURSORLESS-NPC-001` and `DECK-CONSUMER-TEXT-BACK-001`.

### Earlier transport diagnostics

The latest controlled Game Mode diagnostic distinguishes configuration identity
from emission: unique native Gameplay probes have a bound origin, the current
set, revision 2.3 and SDK down/up on an injected Xbox-compatible device. F19
emits no renderer key; a fresh candidate with Ctrl+Shift+F7 emits trusted keys.
Held F7 generates multiple downs with `repeat=false`; Shift and Control release
before F7. Consumer admission must latch the terminal key until its release.
This probe adds a native Gameplay action and performs diagnostic SDK reads, so
it does not qualify unchanged legacy defaults, built-in HID, modifier overlap,
native deduplication or a release. Original installation and Wayland/closed-Steam
state are restored. See `DECK-GAMEPLAY-CHORD-DIAGNOSTIC-001` before a live rerun.

Qualify the local Electron input lifecycle correction; it is not published.
Renderer requests and their coalesced MessagePort frames now retain an optional
correlation ID. A stale pre-focus frame or failed completion cannot retire a
newer request. Gamepad-only preloads invalidate on browser focus, visibility,
freeze/resume and a producer context epoch. A matched refused poll also clears
cached held actions, even without a consumer-specific context message.
A matched new-epoch frame rejected before separate context IPC now clears the
old cached held state too. Unmatched stale replies still cannot clear a newer
cache or retire its request. Eight tests execute the actual compiled service and
standalone preload together; all pass. The advanced service preserves legacy
manual scheduling by default and honors explicit false; managed connectActionInput
defaults to strict correlation. Renderer-owned advanced consumers must explicitly
opt into correlation. Manual/non-correlated mode lacks strict stale-frame proof.
The current Windows JavaScript suite is 495 tests: 492 pass and three existing
skips. Full npm/native tests (101 native
pass, 13 hardware ignores), platform/type/API, native format/check and whitespace
pass. A fresh Linux source fixture with the current JavaScript/template and
recovery notes passes package smoke using a retained Linux native payload only
for package loading. That is not new native or candidate-bound live proof.
Old request/bootstrap forms remain accepted, but a mixed old non-correlated producer cannot provide
the new strict stale-frame guarantee. Consumer rollout must pair matching bytes.

An extended actual Deck Game Mode consumer pass used private current JavaScript
plus the separately identified Linux key addon below. Controller-only shell
navigation, cancellation, scrolling, reconnect and ordinary overlay recovery
worked. Legacy gameplay delivery remained unqualified for injected generic and
Xbox-compatible profiles. A full-screen native text request showed black pixels
and later left action data inactive until app relaunch; ordinary overlay-only
recovery passed separately. Missing callback evidence is not cancellation proof.
See `DECK-NATIVE-TEXT-UI-001` and `DECK-VIRTUAL-PAD-LEGACY-001`. Real built-in HID
and suspend/resume remain open. The consumer also fixed and device-tested its
separate missing loading-cancellation UI. No user binding or published byte
changed. Exact original installed files/modes were restored and temporary
input/debugger/client-serving state was removed. Plasma Wayland Desktop and the
closed Steam baseline were verified after the session switch.

### Settled Linux extended-key correction

A later private consumer QA assembler accidentally reused the published old
Linux addon while updating its archive and JavaScript. That run's negative
stock-map result is not a regression against the corrected addon below.
With the intended unpacked native hash and ASAR integrity metadata verified,
the corrected private candidate again delivered trusted F19/F20 gameplay keys
and consumer UI actions on actual Game Mode. The consumer now gates swaps and
launches on explicit archive/native/SDK identities. Original installation and
Wayland/closed-Steam state were restored. Selected Gameplay configuration and
controller-to-key delivery remain separate open gates: manifest acceptance,
Menu origins and a Gameplay set handle do not establish its selected groups.
Do not reset player layouts or enable native gameplay to bypass that gap.
See `DECK-CANDIDATE-NATIVE-IDENTITY-001` and `DECK-VIRTUAL-PAD-LEGACY-001`.

Fix the confirmed Linux/Deck F13-F24 conversion gap without changing the global
keymap or public input payload. The standard evdev map names these physical
keys FK13-FK24, but its symbols are media actions or NoSymbol; symbol-only
conversion emitted virtual key zero. The repair caches the active server's XKB
key names and rescues only unresolved media/missing symbols on those exact
physical keys. Recognized remaps, printable text, keypad modifiers and dedicated
media keys retain their existing behavior. Core and XKB mapping/name/device
notifications refresh the cache; no server query or allocation was added per key.
Held-key virtual identities remain pinned through repeats and release, so a
mapping change cannot strand the previous key; focus changes clear that state.

The isolated Xvfb/XTest regression failed before the repair with F13 press and
release both reporting zero. It now verifies all twelve down/up pairs through
the real X11/GLX host, alongside punctuation, auto-repeat and pointer edges.
All 62 Linux native tests pass under isolated Xvfb; synthetic XKB name/device
notifications also replace a stale cache from the actual server. A private
consumer on actual Deck Game Mode now received all twelve trusted down/up pairs
from a kernel-uinput keyboard while the original media/NoSymbol keymap remained
unchanged. F19 also worked during gameplay and after ordinary overlay B-close
with native/browser focus restored. Original installed files, symlinks and modes
were restored exactly; the temporary keyboard/pad service, socket and debugger
tunnel were removed. This is focused key conversion proof, not full gameplay,
built-in HID, actual live layout-switch or release-candidate qualification.
Windows `npm test`, platform/type/API checks, native format/check and native
tests pass (101 native passed, 13 existing hardware ignores). Linux package smoke
also passes in an isolated source fixture. A separately identified private Linux
addon was built; it requires at most GLIBC 2.39, not a generic Linux release
baseline. The virtual generic pad still produced no legacy D-pad key during
gameplay despite both controllers reporting the Gameplay set; direct keyboard
F19 on the same candidate worked. Do not treat conversion alone as fixing that
separate unqualified controller/configuration path or alter user bindings.

CI `36956812710` passed unit/native tests, isolated Linux Xvfb, package smoke,
dependency audit and all four Node compatibility jobs, but every platform stopped
at formatting: Rust stable advanced to 1.99 on October 1 and now formats wrapper
macro arguments with trailing commas. Formatting alone reproduced 31 compile
errors against the two older matchers. They now accept optional trailing commas,
with no generated API/argument change; Rust 1.99 formatting is applied. Corrected
Windows native check, full npm/native tests, format and API coverage pass;
the corrected Linux fixture passes all 62 native tests under Xvfb and package
smoke. Follow-up CI `36958046242` at `36a5bfe` passed all nine jobs, including
all three native targets, isolated Linux Xvfb, package smoke, dependency security
and Node 18/20/22/24 compatibility. Next: continue the separate virtual-controller
configuration diagnosis and consumer incoming-code review. The exact Deck-tested native
source remains `f8e01cb`; later formatting/matcher work is not a transferred
candidate-bound live receipt.
No release tag, published package, Steam configuration or global keymap changed.

### Completed incoming-main review

Review of incoming main `b6ccfe3` found and corrected four Deck-helper issues:
the inhibitor stop expanded malformed PID-file contents into `kill` arguments;
capture/close-glyph failures could continue to pointer input and return success;
an identical installed helper without executable permission was treated as
current; and remaining quiet-grep self-test pipelines could fail on producer
SIGPIPE under `pipefail`. Both inhibitor cleanup routes now validate one bounded
positive PID and quote it. Web-close requires its result file and valid display
geometry, propagates capture/detection/input errors and refuses an uncleared KWin
overview. The installer repairs executable permission atomically. Piped source
assertions consume their complete input without changing their conditions.

Failing-before tests reproduced malformed-PID signaling, a successful result
after failed capture/detection, and the non-executable helper installation. The
expanded helper, host-runner and overlay-matrix self-tests pass with stub input
and a local transport. The full Windows checks passed 484 JavaScript tests
(three existing skips), 101 native tests (13 existing hardware ignores), type
checking, platform/API coverage, native format/check and whitespace. No live
Deck session or Steam client was changed in this review.

Dependency auditing also found vulnerable transitive build tools. For that
remediation, only the lockfile records for `brace-expansion` (1.1.21, 2.1.7 and
5.0.12) and `fast-uri`
(3.1.8) changed; their dependency shapes and root dependency versions are intact.
The updated lockfile audits with zero vulnerabilities. A fresh Linux source
fixture with the changed helper/runner/lockfile passed `package:smoke`; the
Windows dependency install, build and typecheck also pass after the updates.
Main CI `36695993346` passed the three platform jobs and dependency audit, but
its package job stopped at `check:electron:latest`: upstream stable had moved
to 44.5.1. The QA example and lockfile now pin 44.5.1; the Windows ASAR fixture
derives its version from that example. A clean Windows install, the latest-pin
gate, full Windows checks and a fresh Linux `package:smoke` fixture all pass.
These are automated repository checks, not new live qualification on 44.5.1.
The follow-up [main CI run](https://github.com/jstroh/steam-bridge/actions/runs/36697016603)
at `c379a76` passed all nine jobs: Windows x64, Apple Silicon macOS, Linux x64
with isolated Xvfb, package smoke, four Node runtime versions and dependency
security auditing. The incoming-main review is complete.
This work changes repository QA tools and development dependencies; the frozen
published 0.4.10 tag and artifacts remain authoritative for that release.

The maintainer accepted the Windows caption-tooltip hover limitation as
non-blocking and requested release of the unchanged frozen `v0.4.10` candidate.
Do not continue tooltip experiments as a release prerequisite or include the
rejected filter. A fresh protected actual-game run on the exact candidate and
Electron 44.4.5 completed the seventeen manual checks and the four schema-7
cases, ending at the original 1280x720 size and position. Native System Menu
Size and keyboard input proved resize/minimum-size behavior; controller-bounded
pointer-border attempts are not claimed as successful. The ordinary Friends
overlay was observed over the game and closed with Escape. Complete unfiltered
logs pass the frozen receipt validator: 380 game samples at 59.9 median paint/fresh/
native FPS and 52 overlay samples at 59.0 median native FPS on a 60 Hz display.
Two JavaScript readiness promises returned false, with no final fallback/bypass;
the separate renderer wait-timeout count remained zero. All runtime/package
hashes and protections passed after clean exit. Owned QA state was restored.

The passing receipt hash is
`4443e024ea220ef013f64aa22197cc087f03887b002f014907b68aa94d7a3e4d`.
Only its sanitized compressed form was configured for the protected publisher.
[Publish run 36381702276](https://github.com/jstroh/steam-bridge/actions/runs/36381702276)
was dispatched once from the immutable tag using Release run 36292417069. The
maintainer approved the protected environment, and the publisher succeeded at
08:13:19 UTC. npm's initial processing delay resolved: an independent registry
download matches all frozen tarball bytes and all 89 package files, including
all three native targets. Registry signature and provenance verification passed,
binding the immutable tag, source and exact publisher invocation; `latest` is
0.4.10. The [stable GitHub Release](https://github.com/jstroh/steam-bridge/releases/tag/v0.4.10)
was published at 08:27:05 UTC after all six assets were independently downloaded
and matched by size/hash. The downloaded PDB matches the published addon and the
downloaded schema-7 receipt validates. The release-scoped proof secret was then
removed; the sanitized proof remains durably attached. Do not dispatch or publish
again. The tag and bytes remain
unchanged. The consumer's separate production build/signing/display gates are
not satisfied by this Bridge receipt.

Historical diagnosis: a controlled 30-second getter-null experiment suppressed
106 native host diagnostic reads, but the trace still recorded 18 long
PeekMessage stalls and fresh delivery stayed near 56 FPS; the getter is not a
necessary cause. Its original descriptor was restored and all QA launch state
cleaned up. Target, display, focus and viewport stayed unchanged.

A narrowly scoped `WM_NCMOUSEHOVER`/`HTMINBUTTON` prototype was rejected by
live evidence and removed from production source. The isolated build passed
102 native tests (13 hardware tests ignored), 485 JavaScript tests (3 skipped),
native check/format, platform/API and symbol checks. Protected actual gameplay
still reproduced recurring long pump gaps on pointer-only Minimize hover;
the diagnostic ring contained no matching hover event and had not filled.
Returning the pointer to the client restored healthy cadence. This public
message is not the observed tooltip callback interception point. Retain the
experimental binary, diff and raw evidence locally, not as release proof.
No global UI/security setting or frame/GPU policy was changed. A safe scoped
remedy remains open; do not ship ineffective interception or consume unrelated
nonclient messages. Preserve frozen candidate bytes below.

The qualified immutable `v0.4.10` candidate is at
`ef0a536fd28fe77ecfdb7571625742b9f609952c`, containing the merged whole-codebase
review (#17), Windows presentation repairs (#18), and narrow review fixes.
The original reports and later local QA have been reconciled. Preserve
the minimize/background recovery, adapter-switch fixes, optional dedicated
copy device, and measured one-frame queue improvement. The tag and candidate
artifacts are durably retained in the verified npm and stable GitHub releases.

### Current review corrections

- Linux keypad virtual keys now use Xlib's modifier-aware lookup for keypad
  navigation/digit keys. Num Lock plus Shift must agree with the text path;
  ordinary physical key mapping, repeat handling and punctuation stay intact.
  The new four-modifier-state press/release regression and all 11 Linux
  native-surface tests passed under isolated Xvfb.
- Windows output-adapter diagnostics now cache discovery per renderer,
  monitor and display-topology generation. Refresh on display/settings events,
  a stale DXGI factory, monitor changes, or renderer/swap-chain replacement.
  Cache missing results and the containing-output fallback too. Monitor-owner
  discovery remains first, including on hybrid GPUs whose swap chain cannot
  report its containing output. This changes diagnostics, not device selection,
  copy ownership, the two-copy bound, Present flags or frame-wait recovery.
- An initial proposal to restore maximum frame latency two was withdrawn
  before commit. The older cadence comparison is not evidence that depth one
  is defective with the newly repaired gating. Later hybrid-laptop QA at
  `2d2baa0` measured cursor latency back at the pre-latch baseline and healthy
  fresh delivery at 60 and 165 Hz. Keep depth one and its regression test;
  qualify cadence and responsiveness together on the immutable candidate.
- Local QA at `7987d63` found an active-overlay/minimized main-thread spin;
  the `bacc50b` retest reports CPU p50 0.2% instead of about one core, healthy
  restore, and no latch. Those newer results supersede the earlier failure;
  they are source-linked local evidence, not a new release receipt.
- Microsoft cleared the submitted local QA addon from `7987d63`, not every
  later build. Its reference SHA-256 is
  `9c6ba67b1c98e6cef5289f3d3b304eff7e1d64027458f6df319f9367ade0f874`.
  A new candidate must be independently hashed and qualified; do not reuse
  the already-published `0.4.9` tag or transfer clearance to different bytes.

The retained QA summaries have been reconciled with raw results and build
hashes; independent review, local checks, main CI and exact-tag CI passed.
Later hybrid tests reused the cleared executable, which currently identifies
Electron 44.4.3; their launch route supports that runtime inference but lacks
per-run executable attestation. Those tests do not qualify Electron 44.4.5.

### Immutable candidate inventory

- Source/main CI: `36292187153`; tag CI: `36292417095`; tag-push Release:
  `36292417069`. All succeeded for the exact candidate source above.
- The canonical package gate, all three native targets, and matching Windows
  symbols were downloaded without rebuilding. The package/bundle/addon hashes
  were independently checked and the publish-artifact verifier passed in
  verification-only mode.
- npm tarball SHA-256:
  `f4d4b7efe898eef14828c191b0ff4dce031ac1320ef1fac455a4fe82371a733f`.
- Windows addon SHA-256:
  `f6c5a686d2ec0694020b9fd0402ac8303eb5bf3c042e467f470ec76faf8fd081`.
- Windows bundle SHA-256:
  `9650a5a4e0ce1d4e0aa09314b53a59f59d7853c5ccd9f0723bac8a1c40dd3279`.
- Verified addon/PDB debug ID: `6cc0954d-3219-43a8-a8ff-220313a8bd3a-1`.

The retained earlier Microsoft-reviewed addon was independently found to match
`9c6ba67b...ade0f874`; it is not the new candidate. On 2026-09-27, the new
candidate's full `f6c5a686...af8fd081` hash, size, source and build were verified
in Microsoft's submission history alongside its clean Smart App Control
analyst reply. Generic pending/in-progress portal labels are not blockers.
Protected actual-game proof on the frozen candidate with Electron 44.4.5 now
passed as recorded above. Do not rebuild, retag, transfer prior clearance or
reuse a prior receipt. Post-publication identity and provenance verification passed.

The 2026-09-27 continuation extracted and fingerprint-verified the canonical
bundle and installed the frozen tarball in isolated staging. The retained
Electron44.4.5 consumer QA executable subsequently received its own clean
Smart App Control analyst reply; its exact submission binding, full file hash
and size were verified independently. The earlier missing executable is no
longer the target. The operator then confirmed other-host Steam/helper isolation
and availability for elevation/authentication. A reviewed isolated consumer
assembler completed, independently verifying every runtime and packaged file
and all 89 Bridge files against the frozen tarball. The already-staged consumer
was protected using the documented owner-right Apply/Audit route, with no
elevation or security-policy changes; an Interactive/Limited launch succeeded.
A scratch ASAR native-placement defect was corrected in a fresh QA directory,
preserving the rejected attempt. Exact native loading and standalone D3D11
startup then succeeded, but Steam explicitly logged the account off with
`Logged In Elsewhere` during qualification. After authorized remote-client/helper
isolation, an unchanged-candidate smoke reached actual gameplay and ordinary
Friends-overlay open/Escape-close, then exited zero with Steam surviving.
Gameplay paint/fresh/native medians were 59.9 FPS at 60 Hz; overlay native
median was 54.9 FPS, below the required 57. After the operator disconnected
remote streaming, a fresh unchanged-byte run without CDP measured 59.9 FPS
game paint/fresh, 59.8 native and 58.9 active-overlay native medians. DPI and
desktop-window coverage also changed, so streaming-only causation is unproven.
The exact Limited process and loaded modules were attested. Basic native
window transitions and the 640x480 minimum recovered; complete display/manual
coverage and final normal-size restoration were unproved by that earlier run.
Raw stderr matches
the Bridge Valve-startup classifier, but the consumer's literal-empty-stderr
contract conflicts with its mandatory CDP evidence and needs explicit resolution.
Five JavaScript readiness promises returned false (which may mean timeout,
unavailability or a stale generation), while the separate legacy renderer
timeout counter stayed zero; that does not establish zero asynchronous DXGI
timeouts. Neither fallback nor bypass remained active.

The local September 28 post-minimize deficit has been causally narrowed: the pointer was
left over the minimize button. A fresh pointer-only A/control/B/A/B/A run on
unchanged protected bytes, without minimizing or any other window transition,
held 59.9 FPS in the client and over plain caption, fell to about 53 native /
55 fresh FPS over the minimize button, and recovered to 59.9 on each return to
the client. A visible Minimize tooltip accompanied the failing hover. All
64 settled final-recovery samples had zero new gaps over 100 ms. Preserve the
earlier failed measurements, but supersede the minimize-required causal claim;
no version-to-version regression has been established.
This approximately 53-native/55-fresh hover result does not explain or replace
the original reporter's approximately 19.5-fresh/60-native hybrid-copy/bypass
problem; preserve the existing minimize/background and adapter repairs.

A separate short Chromium trace places recurring 124-129 ms stalls inside
main-thread PeekMessage with pending sent messages; non-client mouse messages
follow each stall. V8 profiles show no corresponding JavaScript/GC hotspot.
The renderer RAF remains healthy while main-process frame delivery pauses and
then bursts. A follow-up raw-protobuf native trace captured 601 main-thread
stack samples and 17 long PeekMessage spans. All 42 overlapping samples pass
through USER32 `__xxxTooltipCallback -> CreateTooltipWindow -> AnimateWindow
-> AnimateBlend`, ending in a layered-window update or explicit SleepEx wait.
Microsoft public PDB identity was matched using its documented implementation's
GUID/Info-age/DBI-age rule, and PE x64 runtime-function boundaries independently
confirm the tooltip and animation addresses belong to those functions. This
local stall is Windows caption-tooltip fade work on the frame-delivery thread;
the Steam hook is a caller, not demonstrated to own the delay. Why the tooltip
is repeatedly recreated and the appropriate scoped remedy remain open. No
shader, frame-queue, copy-device or restore-policy change follows from this
finding. The raw records and a bounded
second-hover slice are retained alongside an explicit capture-interruption
caveat for the extended observation. See the
[reconciled diagnostic evidence](test-findings-ledger.md#hybrid-gpu-recovery-and-queue-depth-evidence-reconciliation-2026-09-26).

These diagnostic runs exited zero with Steam surviving. Temporary shortcut/task
state was removed and final protection/content audits passed. Publication was
held during diagnosis; the later accepted limitation and successful exact-candidate
receipt are recorded above. Respect the presentation/lifecycle scope boundary
and do not treat the earlier diagnostic instrumentation or preparation as a
passing live receipt. No released runtime change, candidate rebuild or retag
followed from the tooltip experiment.

## Standing decisions

- Linux and Steam Deck Electron packages start with `--no-zygote` and
  `--no-sandbox`; never make them optional. See the
  [sandbox decision](native-overlay-presenter-plan.md#non-negotiable-linuxsteam-sandbox-decision).
- Windows uses the standalone D3D11 game host. Do not return to popup or child
  attached presenters. See the
  [Windows architecture](native-overlay-presenter-plan.md#read-first-after-compaction-windows-architecture).
- Linux and Steam Deck use one visible X11/GLX application-host window and a
  hidden offscreen Electron renderer. See the
  [settled host](native-overlay-presenter-plan.md#settled-linuxdeck-application-host).
- macOS support is Apple Silicon only; never package, launch or verify through
  Rosetta.

### 2026-09-24 whole-codebase review corrections

Fixed with failing-before tests or exact source traces:

- **Linux X11 keyboard.** Printable keysyms were passed through as Windows
  virtual keys (`.` arrived as Delete, `[` as Super). Punctuation now maps to
  the OEM keys, keypad/lock/Pause/Print/Super/Menu keys are mapped, and Num Lock
  selects the keypad level. XKB detectable auto-repeat is enabled and repeated
  presses carry the Windows repeat bit (an Xvfb/XTest hold produced 17
  release/press pairs before). Text comes from `XLookupString` plus
  `libxkbcommon`, so Caps Lock and non-ASCII keysyms work. Live proof is open:
  `LINUX-NATIVE-KEYBOARD-VK-001`.
- **Linux X11 pointer.** Mouse `wparam` now carries the Windows post-event
  button mask. Client geometry is cached per pump batch; 200 queued motion
  events fell from about 11-13 ms to 1.2-2.3 ms under Xvfb (diagnostic, not
  live Deck proof).
- **Windows text.** Non-BMP characters arrive as two UTF-16 surrogate
  `WM_CHAR` messages; the Electron forwarder sent each half alone and Electron
  44.4.5 inserted U+FFFD for each. Surrogates are now paired. Proven live on
  Windows for `SendInput` surrogate pairs and the emoji panel:
  `WINDOWS-NATIVE-CHAR-SURROGATE-001`.
- **Callback dispatch.** User callbacks no longer run under the registry
  mutex; registering or dropping a callback from inside one deadlocked before.
  Unregistering waits for an in-flight hook, and a disconnected JavaScript
  handle ignores events Steam had already queued for the JavaScript thread.
- **`init` app IDs.** Numeric, environment and object forms share one
  validator (positive integer, at most `0xffffffff`).
- **macOS launcher.** The launcher compiled into consumer apps no longer runs
  arbitrary `--steam-bridge-launch-target` paths or applies arbitrary env-file
  variables. The live `core` matrix passed 37/37 at `44b035aa` with App ID
  `480`, every case through Steam and the hardened launcher:
  `MAC-LAUNCHER-ARGUMENT-CONFINEMENT-001` is settled. See the
  [macOS verification](macos-verification-2026-09-24.md).
- **macOS harness.** The matrix environment gate loads the `./steamworks`
  entry, and `npm pack --json` readers accept npm 12's name-keyed output.
- **CI.** Jobs default to `contents: read`; workflow scripts read refs from
  `$env:` rather than interpolating them. Linux reruns native tests under Xvfb
  with `STEAM_BRIDGE_REQUIRE_X11_TESTS=1`. The Windows present-stall unit test
  no longer depends on event-loop timing (reproduced with a 15 ms stall after
  the pump).
- **Smaller fixes.** CPU overlay frames reuse their buffer on Linux and
  Windows; `init` rewrites the Steam app-ID environment only when it differs;
  `build.rs` gates its Windows-only helper; the legacy-layout CLI is committed
  executable.
- **Electron 44.4.5.** Upstream stable moved from 44.4.4, which failed
  `check:electron:latest`; the example, Windows ASAR fixture and lockfile pin
  44.4.5. Earlier 44.4.4 live evidence does not carry over.
- **Privacy.** Committed notes, tests and examples use generic
  `consumer`/`CONSUMER-*` placeholders instead of private product, repository,
  tracker, account-path or app identifiers.

### 2026-09-24 Windows Electron 44.4.5 local requalification

A local, not candidate-bound, Windows pass on Electron 44.4.5 at `727bf77` was
green. See `WIN-ELECTRON-4445-LOCAL-001` for what it covers:

- **Build.** The build was exact: `npm pack` from a scratch copy with the
  addon under its prebuild name, installed as a normal directory into the
  configured consumer. That consumer was overridden locally from its pinned
  Electron 44.4.3 and packaged unsigned for QA.
- **Presentation and overlay.** One standalone D3D11 host rendered at 60 FPS,
  with presenter, native-host and renderer diagnostics agreeing on
  `windows-d3d11`. The QA-menu Friends overlay opened, sent its callbacks and
  closed with Escape, and a duplicate open was suppressed.
- **Window and focus.** Maximize, minimize and restore, keyboard sizing to
  the logical minimum, fullscreen, and focus away and back all passed.
- **Text.** Emoji and non-BMP CJK arrived as one character each.
- **Shutdown.** The app exited cleanly with code 0, and Steam kept running.

Mouse edge, corner and title drags also pass, including the clamp to the
logical minimum, and the host followed a live 125%-to-250% display change.

On 2026-09-25 the published-`0.4.9` QA build was also launched through the
Steam client from a non-Steam shortcut. It passed game entry, backend agreement
in every report, the QA-menu and Shift+Tab overlay open with Escape close, F11
and restore, focus away and back, and an Alt+F4 exit with code 0. Two
behaviours were observed; details are in the ledger row:

- Each Friends activation also raised Steam's desktop client windows. This is
  probably a shortcut-harness artifact.
- The intentional 5-second `windowsSharedTextureResumeDelayMs` hold freezes
  the game image after every overlay close.

Not covered: an immutable release candidate, a display matrix, and receipts. For automation:
an elevated foreground utility makes UIPI silently drop injected input, so
check the foreground owner and the host's message counters before trusting
a `SendInput` result. The public example passes a direct App ID `480` smoke,
but its `presenter-*` actions intentionally fail on Windows, so it cannot
prove Windows overlay routes.

### 2026-09-25 independent Windows review of this branch

- **Fixed:**
  - `29f49d5`: unregistering a Steam-thread hook returned while a dispatch
    was still running, a regression from moving callbacks out of the
    registry lock. A test fails before the fix.
  - `82071f3`: doc corrections: checkpoint-move wording, remaining consumer
    remnants, and `close()` failure behaviour.
- **Rejected:** the missing-XTest CI risk (the Xvfb step ran the end-to-end
  test), surrogate-pairing gaps (traced), and launcher and `npm pack` parser
  memory-safety or shape issues.
- **Residual, not fixed:**
  - A consumer `onBeforeDispatch` hook sees raw surrogate halves.
  - Nested unregistration from inside another dispatch does not wait.
  - The macOS launcher derives its directory from `argv[0]`.
  - The env-file filter is a denylist.
  - Non-init app IDs lack an upper bound.
- **Checks on Windows:** everything passed except `package:smoke`:
  - Passed: `check:platform`, `native:build`, `npm test` (476/473 pass, 82
    native), `native:fmt`, `native:check`, `api:check`, `git diff --check`.
  - `package:smoke` stops on environment only: CRLF checkout line endings and
    an elevated shell. The same write-protection self-test passes with a
    non-admin token.

Verified without code changes: the `NativeBinding` interface matches all 1,153
napi-generated functions by name, arity, parameter type and optionality; all
210 native callback IDs match the SDK; KWin `qdbus` calls are each bounded by
their timeouts; networking batch-receive errors need corrupted Steam structs
and every message is still released.

### 2026-09-25 Steam Deck remote helper

Goal: lasting SSH access to the Deck in Game and Desktop Mode through the
runner, on branch `claude/steam-deck-remote-helper` from `35164c3`.

- **Helper.** `scripts/steam-deck-remote.sh` now holds every Deck session step
  the runner used to send as inline shell: environment and display selection,
  capture, input, focus and state probes, close verification, the shortcut
  wrapper, keep-awake, launch and cleanup. The runner installs it when its
  content changes (`cmp`, then an atomic `mv`) and calls it. A fake-SSH
  comparison against `35164c3` found no change in the seven Python blocks, the
  wrapper, the env-file bytes (including URLs with `?`, `&` and spaces), the
  remote step order, or the runner output.
- **Preflight** also reports the SteamOS release, session mode, Desktop panel
  power, the six runner tools and `/dev/uinput` access. `check_ssh` used to
  succeed even when SSH failed, because it read `$?` after an `if`; it now
  returns the SSH status.
- **Access between runs:** `npm run steam-deck:remote -- <command>`,
  `--mode capture`, `session game|desktop` (`steamos-session-select gamescope`
  or `plasma-wayland`; plain `plasma` starts Plasma X11), and `wake-display`.
- **Live, in the 13:19-13:39 UTC game-lock window:** the helper switched
  Desktop -> Game -> Desktop through `steamos-session-select`, about 8 s each
  way, with a Gamescope capture in Game Mode (`DECK-SESSION-SELECT-001`).
  The matrix `shortcut-friends` case (App ID `480`, the package already on the
  Deck) then passed with both the new runner and the old one, with matching
  artifacts (`DECK-HOST-001`). Steam was shut down again afterwards. Earlier
  live checks were preflight, status, capture and cleanup. Other ledger rows
  from today: `DECK-DESKTOP-DPMS-CAPTURE-001`, `DECK-STEAM-GAME-LOCK-001`,
  `DECK-STEAM-COLD-LAUNCH-001`.
- **Game lock:** the Deck shares one Steam account with other machines. Run
  nothing that starts Steam on the Deck without the account's game lock.
- **Fixed after the comparison:** the web-close probe set `RESULT_FILE`
  without exporting it, so its close wait never read the lifecycle log and
  always waited the full 3 seconds. It was kept unchanged for the byte-for-byte
  runner comparison and is now passed to the wait, which returns as soon as
  the lifecycle log records the close. The wait now takes the result file as
  an argument, and the helper self-test covers both outcomes.
- **Self-test fixes, 2026-09-29:** the inhibitor-cleanup check treated a
  killed but unreaped (zombie) `sleep` as still running, so it failed where
  init does not reap orphans; it now ignores zombies. The runner's wrapper
  checks piped `sed` into `grep -q` under `pipefail`, which could fail on
  SIGPIPE; they now grep captured text. The wrapper env file, which can carry
  the smoke control token, is now written owner-only (`0600`).

## Open consumer and platform follow-ups

1. The Bridge candidate-bound Windows four-case proof on Electron 44.4.5 passed
   as recorded above. A consuming game's changed production package still needs
   its own protected launch, display matrix and required receipts. Earlier local
   emoji/non-BMP input evidence and the new Bridge receipt do not replace those
   separate consumer gates.
   `WIN-OVERLAY-RESUME-HOLD-001` covers the 5-second frozen frame after every
   overlay close. A one-rig A/B (5000, 250 and 0 ms) found no correctness
   failure without the hold. It did find a few slow copies and two single
   Present stalls under 200 ms at resume. A follow-up decision A/B on the
   same rig passed 500 ms, with no stall, slow copy or artifact. 250 ms had
   one 137 ms Present stall, and the 5000 ms hold often froze on a fading
   overlay frame. The consumer now overrides the delay to 500 ms. The
   default stays at 5000 ms until the A/B passes on more GPUs and displays
   and a post-close state signal is found.
   The consumer now pins Electron 44.4.5, which needs a new Windows runtime
   epoch before release.
   `WIN-COPY-COMPLETION-FOCUS-001` has a second affected report on `0.4.9`
   (hybrid NVIDIA laptop: copies about 100 ms and fresh delivery about 19 FPS
   once foreground). A single-GPU desktop did not reproduce it but showed a
   20-36 ms completion floor at 3440x1440@50. Next: a hybrid-GPU run, GPU
   timestamps around the copy, and an A/B that moves the copy off the host's
   render/Present context.
   Cause found on 2026-09-25: one 25 ms frame-wait timeout (minimize,
   occlusion, F11, overlay or a zone load) permanently latches
   `frameLatencyWaitBypassed`; ungated presents then queue ahead of the copy
   on the same context, and cross-adapter present lengthens that queue. See
   `WIN-FRAME-WAIT-BYPASS-LATCH-001`. Done: expected iconic or hidden
   timeouts no longer latch. The occlusion guard never runs, because a
   flip-model swap chain does not return `DXGI_STATUS_OCCLUDED`, so full
   occlusion by another window still latches and recovers through the
   render re-arm. A latch needs three consecutive
   unexpected timeouts, and both native and JavaScript recover without timers
   on restore, occlusion end, a swap-chain resize, or four consecutive
   signalled polls while bypassed. An adapter switch now releases the old swap
   chain before attaching the new one (`WIN-ADAPTER-SWITCH-SWAPCHAIN-001`).
   Diagnostics now report adapter LUIDs, cross-adapter present, latch and
   re-arm counts, and sampled GPU copy time. The opt-in
   `windowsDedicatedCopyDevice` option moves the copy off the host queue:
   latched completion falls from about 48 ms to 1.35 ms in the harness and
   from 20-37 ms to about 1.3 ms live on a single-GPU desktop. It stays off by
   default until an NVIDIA hybrid laptop at 60 Hz passes the candidate gate in
   `WIN-FRAME-WAIT-BYPASS-LATCH-001`.
2. A live Linux Desktop and Steam Deck keyboard case, as described in the
   ledger entry.
3. Maintainer decision: Git history still contains private product names and
   a Steam account number that looked real (see below). Rewriting it needs
   explicit approval.
4. Release procedure: the documentation-only publish route restores the
   predecessor's proven native payload only for the hard-coded `v0.1.6` tag in
   `release.yml`. For any other tag the Release run rebuilds the addons, so the
   route passes only if that rebuild is byte-identical to the previous release.
   Nothing here proves builds are reproducible; confirm it or generalize the
   restore step before relying on the route.
5. Known low-severity items, not fixed: `startSteam()` and
   `configureSteamElectron()` keep owned cleanup entries for resources the
   caller closed until the application closes; the Electron forwarder keys
   held keys by key code, so left and right Shift share one entry.

The smoke self-tests' Steam `userdata` account number also appeared as
`[U:1:…]` in a copied connection log with real timestamps, so it was treated
as a real account ID and replaced with synthetic `12345678`, and the shortcut
app ID with synthetic `3000000001`. The values are arbitrary inside each self-test.

Documentation cleanup (2026-09-25): old checkpoints moved, with private identifiers redacted, to
[checkpoint history](checkpoint-history.md), and standing decisions moved to the
presenter plan. The README, user guides, CONTRIBUTING, RELEASING, PRIVACY,
signing policy and Steam Input example were checked against the code and
corrected. Relative links and anchors across all tracked Markdown are clean.

## Last verification

- 2026-10-06 source preparation: package/root/lock versions agree at0.4.11;
  the example, derived Windows ASAR fixture and exact Electron lock record
  agree at44.6.0, verified against the public registry. This metadata check
  does not prove a locally installed smoke executable. Seven of nine formatter
  regressions fail before the repair, including the real asynchronous Roarr
  child exiting on RangeError. The three-line licensed derivative preserves
  the builder/Get3/proxy/logger versions. All62 focused formatter, unchanged
  upstream and cache/downloader cases pass afterward; the lock audit reports
  zero vulnerabilities, and latest-Electron/platform/whitespace checks pass.
  Initial source a19196a passes eight of nine CI jobs, including both other
  native targets, package smoke and security. Windows CI and Release preflight
  fail only the two formatter/upstream raw-hash checks; reproducing CRLF bytes
  yields both observed hashes. Explicit vendor LF attributes repair checkout
  identity; fresh CI/preflight remain pending. Native artifacts and exact-byte
  Microsoft review remain separate pending gates.
- 2026-10-04 follow-up build-cache guard review: sixteen added failing-before
  cases expose forbidden extension/error fallback, request/Vary mismatches and
  stale shared s-maxage reuse in the preceding local patch. The explicitly
  versioned `.2` derivative applies a common restriction to evaluateRequest and
  both stale-extension helpers, and validates request matching/no-cache before
  error fallback. All fifty repository cases pass, including the actual cached
  downloader's 503 rejection, permitted public fallback and conditional 304
  reuse. The unchanged exact upstream128-test suite passes. Only the local
  policy version lock record changes; stable builder/get versions remain intact.
  Full Windows545 JavaScript tests (542 passes/three skips),101 native passes/
  13 ignores and all normal gates pass. Fresh locked Linux installation passes
  all50 policy cases and complete package smoke with an unchanged lock, using
  the retained native payload for loading only. Eight actual canonical
  downloader/TLS checks pass. Consumer build-only integration also passes its
  focused installed-source/downloader checks and fresh Linux lock install;
  its separate lint-tool braces advisory remains unpatched. Source push and
  current-byte CI are next. Earlier nine-job CI below qualifies `.1`, not these changed bytes.
  This is build-tool source proof, not a new device, native or release receipt.
- 2026-10-04 compatible build-cache repair: the root development dependency now
  selects the explicitly versioned local `4.3.0-steam-bridge.1` derivative, with
  BSD license/provenance retained. A synchronous revalidation guard rejects the
  known `max-stale` and response-no-cache bypasses without changing stable
  builder/downloader APIs. Seven of eighteen policy cases failed before; all
  eighteen and serialized controls pass after. The exact upstream128-test suite
  and eight actual downloader/TLS loopback controls pass. The repository's24-case
  gate follows the real builder dependency chain and checks the installed bytes,
  proxy, timeout, retry, mirror, checksum and artifact-cache behavior.
  Full Windows npm/native, platform/API, native formatting/check and whitespace
  pass:519 JavaScript tests (516 passes/three skips),101 native passes/13 ignores.
  Only the root, old policy and new local policy lock records change. Windows
  lock-only audit and a fresh locked Linux install report zero vulnerabilities;
  Linux policy tests and complete package smoke pass, with its lock unchanged.
  The retained Linux addon is used for loading only, not a new native/device
  qualification. Source `8f81b19` is pushed and its remote hash verified. CI
  [37225511429](https://github.com/jstroh/steam-bridge/actions/runs/37225511429)
  passed all nine jobs, including all native targets, package smoke, npm/Rust
  security audit, the Node22.13 development floor and packed Node18/20/22/24
  runtime compatibility. No published runtime payload, downloader-major override, audit exception,
  system security policy or release qualification changes. See the
  [repair receipt](build-cache-policy-remedy-review-2026-10-04.json) and
  [provenance/retirement conditions](../../vendor/http-cache-semantics/BRIDGE_PATCH.md).
- 2026-10-04 upstream-cache recheck: npm published http-cache-semantics 4.3.0,
  but its integrity-verified source does not change the reported max-stale
  reuse branch. Isolated actual-module comparisons against installed 4.2.0
  reproduce the same shared-cookie, proxy-revalidate and response-no-cache
  counterexamples in both versions, including serialized policy round trips.
  The three ordinary/revalidation controls also agree. The advisory currently
  lists affected versions only through 4.2.0, but that range is not evidence
  that 4.3.0 remedies the observed behavior. No repository dependency update,
  downloader override, audit suppression or publication was performed. An
  actual-module loopback comparison now rejects a raw downloader-major-5 override:
  it ignores the builder's request timeout and explicit HTTP proxy agent, and its
  HTTP503 error no longer matches the builder's retry predicate. The checksum
  and artifact-cache controls pass in both versions. The stable v26 registry tag
  still requires downloader major 3; the major-5 toolchain is an uninstalled alpha.
  This is compatibility evidence, not a completed security repair or live exploit.
  See the [downloader comparison](build-downloader-compatibility-review-2026-10-04.json).
  The unchanged upstream and raw-major rejection remains valid; the later local
  compatible repair is recorded above. See the sanitized [source review receipt](cache-policy-security-review-2026-10-04.json)
  and `CROSS-BUILD-UNPATCHED-CACHE-AUDIT-001` in the ledger.
  Full Windows npm/native tests, platform/API, native formatting/check and
  whitespace checks pass. An isolated Linux Git-archive fixture with these
  documentation changes passes complete package smoke after a fresh locked
  npm ci; its lockfile hash is unchanged. The retained Linux addon is used
  only for package loading, not new native or candidate-bound live proof.
- 2026-10-03 source CI at `0b07a8e` completed: Windows, Linux (including
  isolated Xvfb), Apple Silicon macOS, package smoke and all four Node runtime
  jobs pass. The dependency audit fails on GHSA-ch52-4w7c-c8xp, propagated into
  eight high-severity development/build-tool findings. Production-only audit
  is clean. As of that check, latest http-cache-semantics was affected 4.2.0
  with no patched version; the separate 4.3.0 source recheck above retains the
  blocker. Do not force
  a builder downgrade or override its downloader across a breaking major API.
  No audit bypass, package publication or release qualification followed.
  See `CROSS-BUILD-UNPATCHED-CACHE-AUDIT-001` in the findings ledger.
- 2026-10-03 reviewed input source at `e1d2495`: full Windows npm test passes
  492 JavaScript tests (three existing skips) and 101 native tests (13 hardware
  ignores), plus platform, native format/check, API and whitespace gates. Eight
  actual service/preload tests preserve both strict renderer polling and advanced
  manual compatibility. A fresh Git-archive Linux fixture passes build and complete
  package smoke using a retained Linux native payload only for package loading;
  this is not new native or candidate-bound live proof. The native Windows package
  smoke hits the already-recorded POSIX-permission environment limitation; no host
  security or permission policy was changed. Source push does not publish, repin,
  transfer old live qualification or satisfy the remaining consumer/device gates.
- 2026-09-30 incoming-main review: the four helper corrections above have
  failing-before coverage. With the QA example on Electron 44.5.1, full
  Windows tests, typecheck, platform/API checks, native format/check, the
  latest-pin gate, zero-vulnerability dependency audit and fresh Linux
  `package:smoke` pass. No live Deck session or release artifacts were changed.
- 2026-09-29, main `aceeb4c` merged with the Deck helper branch plus the fixes
  above, on Linux: helper, runner and matrix self-tests, `npm test`
  (487/487 JavaScript plus native tests), `package:smoke`, `check:platform`,
  `native:fmt`, `api:check`, and `git diff --check`. No product code changed.
- Release 0.4.10: exact-tag CI/build and protected schema-7 four-case proof
  passed; npm signature/attestation and 89-file identity checks passed; all six
  GitHub assets matched independent downloads and the Windows symbols pair.
  The final documentation/recovery update passed `package:smoke`, whitespace
  checks and an independent privacy/accuracy review. The Windows tooltip hover
  limitation remains explicitly accepted, not fixed.

- A focused installed-`0.4.9` high-refresh diagnostic on Windows 11 / AMD hybrid
  hardware held 165.0 fresh FPS and 164.53 native/DXGI FPS for an uncontaminated
  30-second interval at 165 Hz. A subsequent external desktop-mode/DPI change
  moved the display to 60 Hz and latched the old JavaScript wait fallback.
  A later PresentMon trace measured 59.915 displayed FPS but about 79.87 ms
  median Present-to-display delay. This is old-runtime diagnostic evidence,
  not a candidate pass or physical input-latency measurement. After the remote
  session ended, a clean restart and uninterrupted minute at 165 Hz held
  164.973 fresh / 164.174 native-DXGI FPS, with two admission drops, 36 repeated
  refreshes, no fallback and no Present budget overruns. The second trace
  elevation request was canceled, so this minute uses built-in/DXGI evidence,
  not a 165 Hz OS trace. The game/debug listener exited and the original desktop
  mode was restored; see `WIN-HIGH-REFRESH-PRESENT-001` in the ledger.

- Main `9ec1faa`: all CI jobs passed; local `npm test` passed 484 JavaScript
  tests (3 skipped) and 98 native tests (13 hardware tests ignored). Platform,
  native formatting/check, API coverage and dependency audit passed.
- Current narrow correction: Windows native tests passed 101/101 (13 hardware
  tests ignored); Linux native-surface tests passed 11/11 under Xvfb. Full
  Windows npm test passed (484 JavaScript tests, 3 skipped), as did formatting,
  native check, API coverage, platform check, dependency audit and diff check.
  Exact corrected-tree and tag CI/package smoke also passed. Two focused
  actual-device tests passed separately: output ownership without a swap chain,
  and copy timing/adapter diagnostics. They do not replace candidate-bound
  actual-game live proof; that separate proof subsequently passed as recorded above.
- Steam Deck remote helper branch on macOS: runner, helper and matrix
  self-tests, `npm test` (477/477 JavaScript plus native tests),
  `package:smoke`, and `git diff --check`. Live on the Deck (SteamOS 3.8.11)
  at `c0e047b`: both session switches and the `shortcut-friends` case with the
  new and the old runner.
- CI green on every job at `a27b9cc`. Locally: `npm test` 476/476, native tests
  including the X11 tests under Xvfb, `npm run api:check`,
  `npm run check:platform`, and `git diff --check`.
- macOS Apple Silicon: `core` overlay matrix 37/37 at `44b035aa`.
- Windows 11 x64 at `727bf77`: `npm test` 476 tests (473 pass, 3 skipped),
  81 native tests passing with 3 hardware-only tests ignored, the local
  Electron 44.4.5 live pass above, and the example's direct App ID `480`
  smoke. On 2026-09-25 at `6b43256`: `npm test` again 476 tests (473 pass, 3
  skipped) and 82 native tests, plus the Steam-client shortcut launch.
- WSL2 Ubuntu 26.04.1 LTS on the same laptop at `6b43256`, with Node 22.23.3
  and Rust 1.98.1, from a Linux-filesystem clone with LF line endings. These
  are routine checks only; WSL gives no live Steam overlay proof.
  - Passed: `npm ci`, `check:platform`, `native:build`, `native:fmt`,
    `native:check`, `api:check`, `package:smoke`, `git diff --check`, and the
    native tests under Xvfb with `STEAM_BRIDGE_REQUIRE_X11_TESTS=1`.
  - `npm test` passes 476/476 JavaScript and 57/57 Rust tests with `DISPLAY`
    unset, as in CI. Under WSLg's own XWayland display,
    `x11_probe_window_reports_keyboard_and_pointer_edges` runs without the
    Xvfb requirement and fails its XTest button-click assertion. The keyboard
    assertions before it pass, and the same test passes under Xvfb, so run
    Linux native tests under Xvfb on WSLg.
