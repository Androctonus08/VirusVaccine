# VirusVaccine

An independent, open-source Windows malware scanner with an original desktop interface and the ClamAV scanning engine. **0.2.0 is a functional preview, not a replacement for a complete endpoint-protection suite or a claim of McAfee-equivalent efficacy.**

![VirusVaccine logo](src/renderer/assets/logo.svg)

## What works

| Capability | This release |
| --- | --- |
| Independent scanning | ClamAV 1.5.4, downloaded from its official release and verified against a pinned SHA-256 |
| Definitions | Official FreshClam updates; stale, missing or unverified definitions prevent scanning |
| Scan choices | Quick scan of Downloads/Desktop/temporary files, selected files, folders, or drive roots |
| Results | Live counts, cancellation, detections, skipped/unreadable counts, history and JSON export |
| Quarantine | User-confirmed encrypted copies, verified source removal, restore without overwrite, separate permanent deletion |
| Folder monitoring | Optional scans after changes in selected folders while the app is running |
| Scheduling | Optional daily quick scan while the app is running; missed time runs when next eligible |
| System status | Read-only Windows antivirus registrations and firewall profiles; links to Windows settings |
| Scam and link checks | Offline English-language message heuristics, actual hostname inspection and tracking-parameter removal; no message upload |
| Browser companion | Separate Chrome/Edge extension with a small third-party tracker blocklist, pause/resume, link tools and confirmed cookie/cache cleanup |
| Privacy controls | Links to Windows camera, microphone and privacy settings |
| VPN and breach-alert setup | Official WireGuard and Have I Been Pwned setup flows; services are operated and managed externally |

There is **no execution-blocking driver, ransomware behavior shield, boot-time scanner, malicious-site reputation filter, firewall enforcement, built-in VPN, password manager, identity monitoring or recovery service**. Folder monitoring does not stop a file from executing before it is scanned. Antivirus registration is not proof that a product is active. Scam checks are limited heuristics; an absence of warning signs does not establish safety. There is no paid subscription or cloud file upload.

Open **Web & privacy** to export and install the companion in each browser profile. It is not installed automatically or published in an extension store. See the [browser guide](docs/BROWSER.md), [provider setup guide](docs/PROVIDERS.md), and [McAfee feature comparison](docs/PARITY.md).

## Run on Windows x64

Download the portable executable from [Releases](https://github.com/Androctonus08/VirusVaccine/releases), launch it, and choose **Set up VirusVaccine**. Setup needs an internet connection and disk space for the engine and signature databases. This preview is unsigned. Keep your existing antivirus enabled.

Choose **Update definitions** before scanning if needed. Updates are user initiated in this release. Definitions checked more than seven days ago are rejected. A completed scan means the selected eligible files were checked; it is not a guarantee that a file or computer is safe.

Data normally lives in `%APPDATA%\virusvaccine`: local settings, reports, encrypted quarantine and the engine. **Open data folder** shows the actual location. The quarantine key is protected for the Windows user by Electron secure storage. Preserve that data folder and Windows user profile to retain recovery access. Restore keeps the encrypted copy until you explicitly delete it.

Closing during a scan or with automation enabled keeps the app in its tray. Use the tray's **Quit VirusVaccine** command to exit. No service, scheduled Windows task, startup registration, security-provider registration, protection exclusion or firewall rule is installed.

## Build from source

Use Windows x64, Node.js 24 LTS, npm, and Git:

```powershell
git clone https://github.com/Androctonus08/VirusVaccine.git
cd VirusVaccine
npm ci
npm run check
npm test
npm start
npm run dist
```

The portable application is written to `dist/`. Electron and ClamAV are pinned separately. The portable application contains Electron and VirusVaccine; it downloads ClamAV directly from upstream during setup.

After building, `Launch VirusVaccine.cmd` opens the portable application and reuses this checkout's `.runtime` engine when it has already been verified. `node scripts/verify-package.cjs` checks the built application with an isolated profile and harmless file.

For a development engine stored in this checkout:

```powershell
npm run verify:engine
npm run verify:pipeline
$env:VIRUSVACCINE_RUNTIME_DIR = Join-Path $PWD '.runtime'
npm start
```

`verify:engine` downloads official definitions and tests real ClamAV using ordinary text and a fresh harmless custom signature. `verify:pipeline` exercises the production scanner and encrypted quarantine with another harmless marker. Neither uses live malware or EICAR. `npm run review:ui` requires Microsoft Edge; `npm run review:native` requires the verified `.runtime` engine and opens an isolated Electron test window. `npm run review:browser` verifies the companion with Playwright Chromium in a temporary profile; install it using `npx playwright install chromium`. Private review artifacts are ignored by Git.

## Coverage and evidence

Individual files are limited to 128 MiB; a scan enumerates at most 50,000 files. Archive processing has bounded depth, size, time and entry counts. Symbolic links/junctions, inaccessible files and exceeded limits are reported as gaps. Windows short-name aliases can also be skipped; select the expanded path in the file picker. An interrupted or incomplete scan is never labeled a complete clean result. Quarantine refuses system/application locations, hard-linked files and files that changed after detection. It preserves an encrypted recovery copy before moving the original.

The [feature scope](research/feature-matrix.json) and [design notes](research/README.md) document general capabilities and implementation limits. Private machine observations are not published. This is an independent implementation. The [validation report](docs/VALIDATION.md) separates functional checks from unmeasured malware efficacy. See [SECURITY.md](SECURITY.md) for trust boundaries and known limitations.

Application source and original artwork are MIT licensed. ClamAV remains separately licensed under its upstream GPL terms. See [third-party notices](THIRD_PARTY_NOTICES.txt).
