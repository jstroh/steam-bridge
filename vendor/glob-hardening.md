# Build-only glob and minimatch hardening

These are explicitly named, private local derivatives, not upstream releases
and not dependencies of the published Steam Bridge runtime. Their original
Blue Oak/ISC licenses and authorship remain in each source directory and
archive. Existing builder, ASAR, downloader and legacy glob versions remain
unchanged; callback and callable-module APIs are not replaced by newer majors.

[The provenance inventory](glob-hardening-provenance.json) pins all five
upstream npm archive integrities and source commits, every original/derived
file hash, and each retained derivative archive. Compiled upstream JavaScript
and declarations are retained as readable source under `lib` rather than
ignored `dist`. Source maps and upstream development scripts/dependencies are
omitted. Entry points select the readable files rather than an unchanged
minified bundle. LF/terminal-newline and trailing-whitespace normalization is
nonfunctional; raw original hashes remain retained separately from normalized
control hashes. No native binaries or credentials are included.

## Repairs and limits

- `glob13` derives from13.0.6. Both module formats apply upstream
  [4682e8c](https://github.com/isaacs/node-glob/commit/4682e8c9babee1b385202ede36389634e12076d7):
  return immediately from the four aborted walk branches and let pending
  resume callbacks reach that completion path. The actual filesystem test
  reproduces continued traversal before this repair and zero new reads after
  cancellation afterward. Ordinary synchronous/asynchronous results agree.
- `minimatch9` and `minimatch10` derive from9.0.9 and10.2.6. Both module formats
  backport upstream
  [77a0f5c](https://github.com/isaacs/minimatch/commit/77a0f5c4b80bdc641c3c930a1d9edf5ad2db57f8):
  stop optimizer-generated `**/..` splits at `braceExpandMax` (default100,000)
  and skip pairwise deduplication above1,000 rows. The9.x declaration gains
  that optional bound. Small-pattern matching and existing APIs are preserved.
- `minimatch3` and `minimatch5` derive from3.1.5 and5.1.9. They do **not** contain
  the newer optimizer implicated by the advisory; this is not a claim that
  its exact exploit reproduces there. Instead, a real additional guard bounds
  their compilation allocations: scan actual expanded strings linearly,
  counting components exactly as `/\/+/` splitting would, and throw a clear
  `RangeError` above100,000 aggregate components before splitting or parsing.
  No new options are added or forwarded. Existing brace-expansion count,
  character, nesting and rewrite ceilings remain unchanged. A138-character
  pattern previously compiled135,168 components; the repaired path rejects it
  before any component split/parser call. Exactly100,000 components remain
  accepted, including repeated slash separators.

This bounds the tested preprocessing/compilation work. It is not a claim of
complete regular-expression or matching DoS immunity. Extreme legacy patterns
that exceed the new allocation budget now fail explicitly, not with a silent
partial match. Ordinary caller patterns, defaults wrappers, CJS/ESM imports and
real ASAR3/4 unpacking are regression-tested.

## Selection and verification

The root build tooling selects immutable retained archives using matching-major
overrides. The archives contain exactly the reviewed source inventories.
Portable SHA-pinned GitHub archive URLs avoid npm resolving local directory
overrides relative to nested callers. Lockfile integrity adds a second byte
binding; no mutable branch URL, private absolute path, audit exception, reduced
threshold or production-only audit substitutes for the full security gate.

To reproduce an archive from reviewed source, use `npm pack ./vendor/<directory>
--ignore-scripts --pack-destination <temporary-directory>`. Compare its complete
inventory and bytes with the retained archive before changing a dependency pin.
The installation regression checks actual caller resolution and all installed
source bytes, not just declared versions. Tests reconstruct and hash-check the
unchanged upstream implementations before exercising the failing controls.

Retire each derivative only when a maintained compatible upstream replacement
fixes or removes the affected behavior and passes the same counterexamples,
API/caller checks, clean-install, package and full audit gates. Neither a green
version-range report nor this build-tool repair qualifies native artifacts,
gameplay, devices or a release candidate.
