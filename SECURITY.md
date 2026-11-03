# Security scope

VirusVaccine 0.3.0 is an early Windows x64 scanner. It has not undergone an independent security audit, malicious-corpus efficacy evaluation or adversarial tamper-resistance review. Do not disable an existing endpoint-security product to use it.

## Boundaries

- The renderer has no Node integration, uses context isolation and sandboxing, denies new windows and permissions, and loads only local assets under a restrictive CSP. IPC accepts a fixed set of actions from the main frame. Native dialogs choose scan and restore paths.
- ClamAV setup permits a fixed official HTTPS release and verifies its exact length and pinned SHA-256. It uses an app-owned runtime directory and rejects linked paths. FreshClam validates official database updates. Readiness checks are not an attestation against an attacker who already controls the Windows user account.
- Scanning runs as the current user with no shell interpolation. It does not request elevation or bypass inaccessible files. Explicit engine results and a positive signature count are required. Incomplete coverage remains visible.
- Quarantine uses AES-256-GCM with a random per-user key protected by Windows secure storage. A verified encrypted copy and journal are saved before source removal. Unique same-volume staging reduces replacement races; changed staged content is preserved and its recovery path reported. This is not protection against a hostile administrator, kernel malware or another process with full control of the same Windows account. Quarantine files and their directory are not a Windows security isolation boundary.
- Restore verifies authentication and SHA-256 and creates a new destination exclusively. It never silently overwrites a file. The encrypted copy remains until explicit deletion. A crash or I/O failure can leave a recovery copy/staging file; do not delete it until recovery has been checked.
- File-change monitoring is best effort and can miss events or exceed its queue. It runs only while the app is alive and does not intercept file execution. Scheduling has the same application-lifetime boundary.
- The application does not upload scanned files or reports. Engine downloads and definition updates contact the upstream services. Windows itself and an existing antivirus may separately inspect files and network traffic.
- Message and link checks are bounded, offline heuristics, not a scam classifier or reputation service. Drafts are kept only in memory until cleared or the app exits. No safe verdict is returned. Suspicious text is rendered using text nodes, never HTML.
- The separately installed browser companion uses a fixed third-party tracker ruleset and the browser's own cleanup API. Cookies are unselected by default; deletion requires explicit confirmation. It requests no access to page contents, no native messaging connection and no telemetry. A small blocklist is incomplete and can break sites; it can be paused. See [browser scope](docs/BROWSER.md).
- Provider links are fixed official HTTPS destinations opened only after a button click. No provider credentials, VPN configurations or email addresses are collected. Provider-managed protection is not verified or represented as active by VirusVaccine.

- Firewall mutation accepts a native-picked executable or a validated owned rule identifier. A fixed PowerShell program runs through UAC; it manages only the VirusVaccine rule group. It cannot turn profiles off, reset the firewall or edit another product's rules. Rules depend on Windows Firewall and other installed policies; status is not an efficacy guarantee.
- Media assets have fixed upstream revisions, sizes and SHA-256 hashes. Decoder executables/libraries are checked against packaged digests, and model integrity is rechecked before analysis. Media parsing and inference run in a separate unprivileged process with bounded input size, time, sample count and decoder output. Decoder formats/protocols exclude playlists and network fetching. This process separation is not an OS sandbox against decoder exploits. Results are kept in memory and never uploaded.
- Native guard source is a laboratory fork of Microsoft AvScan under MS-PL. It is not installed by the desktop app. The test scope, incomplete coverage, unsigned state, unauthenticated local ClamAV protocol and outstanding service/driver hardening are documented in [native guard scope](native/guard/README.md). It must not be represented as production prevention.

## Reporting a vulnerability

Use the repository's private vulnerability reporting feature when available. If unavailable, open an issue requesting a private contact without including exploit details, credentials, private file paths, samples or personal data. Do not upload malware to this repository.

Include the VirusVaccine version, Windows version, relevant component, a harmless reproduction, and the practical impact. Preserve local quarantine recovery data when reporting a storage problem.
