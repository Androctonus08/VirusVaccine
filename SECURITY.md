# Security scope

VirusVaccine 0.1.0 is an early Windows x64 scanner. It has not undergone an independent security audit, malicious-corpus efficacy evaluation or adversarial tamper-resistance review. Do not disable an existing endpoint-security product to use it.

## Boundaries

- The renderer has no Node integration, uses context isolation and sandboxing, denies new windows and permissions, and loads only local assets under a restrictive CSP. IPC accepts a fixed set of actions from the main frame. Native dialogs choose scan and restore paths.
- ClamAV setup permits a fixed official HTTPS release and verifies its exact length and pinned SHA-256. It uses an app-owned runtime directory and rejects linked paths. FreshClam validates official database updates. Readiness checks are not an attestation against an attacker who already controls the Windows user account.
- Scanning runs as the current user with no shell interpolation. It does not request elevation or bypass inaccessible files. Explicit engine results and a positive signature count are required. Incomplete coverage remains visible.
- Quarantine uses AES-256-GCM with a random per-user key protected by Windows secure storage. A verified encrypted copy and journal are saved before source removal. Unique same-volume staging reduces replacement races; changed staged content is preserved and its recovery path reported. This is not protection against a hostile administrator, kernel malware or another process with full control of the same Windows account. Quarantine files and their directory are not a Windows security isolation boundary.
- Restore verifies authentication and SHA-256 and creates a new destination exclusively. It never silently overwrites a file. The encrypted copy remains until explicit deletion. A crash or I/O failure can leave a recovery copy/staging file; do not delete it until recovery has been checked.
- File-change monitoring is best effort and can miss events or exceed its queue. It runs only while the app is alive and does not intercept file execution. Scheduling has the same application-lifetime boundary.
- The application does not upload scanned files or reports. Engine downloads and definition updates contact the upstream services. Windows itself and an existing antivirus may separately inspect files and network traffic.

## Reporting a vulnerability

Use the repository's private vulnerability reporting feature when available. If unavailable, open an issue requesting a private contact without including exploit details, credentials, private file paths, samples or personal data. Do not upload malware to this repository.

Include the VirusVaccine version, Windows version, relevant component, a harmless reproduction, and the practical impact. Preserve local quarantine recovery data when reporting a storage problem.
