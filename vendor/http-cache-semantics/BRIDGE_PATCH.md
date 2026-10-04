# Build-only cache-policy repair

This is a local, explicitly versioned derivative of `http-cache-semantics` 4.3.0,
not an upstream release. The BSD-2-Clause copyright and license are retained.
The root development-tool dependency override selects this source; it is not a
dependency or payload of the published Steam Bridge runtime package.
Its metadata labels the local derivative and omits upstream-only test-tool
scripts/dependencies; no downloader or application dependency versions change.

Upstream source: commit `b1d4bd682fbab0252985de45219f4e7497c0067c`, matching the
[4.3.0 npm artifact](https://registry.npmjs.org/http-cache-semantics/4.3.0).
The original `index.js` SHA-256 is
`ede1cc404a492fa348eb9d97a3007a0d72aa717bd22cd86a56bd0824c19729ca`.
The corrected `4.3.0-steam-bridge.2` source SHA-256 is
`07116662fec83d8b195aec37b7893c8b2234b60cb60830420fe0689b718026d0`.

The implementation strengthens the synchronous revalidation guard and applies
the same restriction to both stale-response extension helpers. Non-storable
responses, response `no-cache`, shared
`proxy-revalidate`, and shared cookie responses without the library's existing
explicit public/immutable opt-in cannot become hits through `max-stale` or
`stale-while-revalidate` or `stale-if-error`. Stale shared `s-maxage` responses
also require validation; fresh shared and private-cache controls remain intact.
Failed validation cannot reuse content for a different URL, host, method or
Vary selection, or override request `no-cache`/Pragma. Successful matching 304
validation still works. Serialization, validators and the public API remain
intact. This addresses the observed
[advisory counterexamples](https://github.com/advisories/GHSA-ch52-4w7c-c8xp)
with code, not an audit exception or a downloader-major override.

The exact upstream 128-test suite passed on the corrected source. The repository
regressions additionally exercise the real builder dependency chain, policy
round trips, failed/successful validation, request timeouts, explicit proxies,
retry classification, mirrors,
checksums and artifact-cache modes. Isolated loopback TLS checks also confirmed
default certificate rejection and successful verification with an explicit
test CA; no system trust or security setting was changed.

The actual cached downloader rejects 503 fallback for `no-cache`,
`must-revalidate` and stale shared `s-maxage`, but retains explicitly permitted
public fallback and successful conditional 304 body reuse. Sixteen added cases
fail against the preceding local patch; all fifty repository cases and the
unchanged upstream suite pass on this revision. The constraints follow
[RFC 9111](https://www.rfc-editor.org/rfc/rfc9111.html#section-4.2.4).

Remove this override only after a replacement's implementation rejects the
counterexamples and preserves the controls. A clean version-range audit alone
does not establish that behavior. Revalidate installed-source identity, the
upstream suite and build/package checks whenever this patch or its selection
changes. Actual device and release-candidate qualification remain separate.
