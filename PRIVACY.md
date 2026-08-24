# Privacy policy

Steam Bridge is a developer library. It does not operate a maintainer-owned
analytics service and does not transfer telemetry, Steam identities,
authentication tickets, credentials, input, crash data, or game data to Steam
Bridge's maintainers.

The library communicates with other systems only when specifically requested
by the application or the person installing or operating it. Examples include:

- calls to the locally installed Steam client and Valve Steamworks services;
- opening a Steam overlay page requested by the application;
- publisher Web API requests to an endpoint and credential explicitly supplied
  by trusted server code; and
- local diagnostic or QA output explicitly enabled by the operator.

Applications that use Steam Bridge are separate products. Their developers are
responsible for their own privacy notices, consent, collection, retention, and
network behavior. Steam and Steamworks are governed by Valve's published
privacy terms.

Uninstalling the npm package or removing the application that bundled it removes
Steam Bridge. The library does not install a background service, startup item,
browser extension, driver, or system policy.
