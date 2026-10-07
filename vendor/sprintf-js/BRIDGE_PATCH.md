# Build-only numeric-precision repair

This is an explicitly versioned local derivative of `sprintf-js`1.1.3, not
an upstream release. Its BSD-3-Clause copyright and license are retained.
The root development dependency supplies the override beneath `roarr`2;
the published Steam Bridge package has no dependency on this formatter.
The builder, downloader, proxy library and logger versions remain unchanged.

Upstream source is commit `3a0d8c26d291b5bd9f1974877ecc50739921d6f5`, matching
the [1.1.3 registry artifact](https://registry.npmjs.org/sprintf-js/1.1.3).
Original `src/sprintf.js` SHA-256:
`95add43f116385be221745307fae02d06751b01d4f939df1debb17dbe2ebf4eb`.
Corrected `1.1.3-steam-bridge.1` source SHA-256:
`3b794a3e3e6ded7aca3cda9b434e080148c261f8bf2ed4d7136c23181ec937b5`.
The unchanged pinned upstream `test/test.js` SHA-256 is
`6494260db1acd5d551b201559c3b2f50b06dedd01d05532fe82ef41614939400`.

Only three numeric conversion arguments change. `%e` and `%f` cap precision
at100; `%g` bounds it to1–100. The parser supplies non-negative digit strings,
so this also bounds values that convert to Infinity. Explicit zero precision
still reaches the fixed/exponential methods; general zero precision uses one.
Omitted precision, valid precision, positional/named placeholders, callbacks,
`vsprintf`, string truncation and existing unrelated error contracts are intact.
Unsupported numeric precision no longer aborts asynchronous logger calls with
the reported RangeError. This fixes the observed
[advisory](https://github.com/advisories/GHSA-hp3w-g68c-fv3c), not every invalid
format or unbounded-width/resource behavior.

The actual builder chain resolves the corrected bytes through Get3,
global-agent3 and Roarr2. The regression reproduces the advisory failures and
uncaught asynchronous Roarr process exit before the repair, then requires
bounded output and unchanged context afterward. Valid-precision, invalid-type,
upstream formatting and existing real downloader contracts remain tested.
No remote formatter-input route was found in the current proxy's constant
messages; this is a dependency repair, not a demonstrated remote build exploit.

Do not substitute global-agent4.1.3 solely to obtain a green audit. Its published
[Agent source](https://github.com/gajus/global-agent/blob/v4.1.3/src/classes/Agent.ts)
changes TLS-option forwarding to a `secureEndpoint` condition absent from normal
Node/Get3 requests, and its absolute-URL check uses nullish coalescing on booleans.
These are source compatibility findings, not executed live-network evidence.

Retire this override only when a maintained upstream chain removes or repairs
the affected implementation and passes valid-format, asynchronous-logger and
downloader proxy/cache/retry compatibility checks. A clean version-range audit
alone does not establish that behavior. No audit suppression or runtime payload
change is introduced.
