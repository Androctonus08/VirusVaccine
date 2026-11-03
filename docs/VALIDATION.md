# Validation of 0.3.0

Functional checks on Windows x64. This report covers implementation behavior, not malware detection accuracy or commercial antivirus parity.

| Check | Result |
| --- | --- |
| Engine installation | Official ClamAV 1.5.4 archive downloaded; exact length and SHA-256 verified |
| Official definitions | FreshClam validation and benign scanning succeeded |
| Real process return codes | Benign file 0; random harmless signature match 1; unavailable database 2 |
| Production scanning pipeline | Real ClamAV detection parsed; source SHA-256 verified; encrypted quarantine, restore integrity and deletion passed |
| Native desktop | Actual Electron window, all desktop routes, Windows read-only status, benign real scan, history persistence |
| Automation | Actual file-change scan and scheduled scan, each completed against a harmless fixture; settings and scan history survived restart |
| Packaged application | Built Electron application launched with an isolated profile and completed a real benign scan; embedded application sources matched the checkout |
| Renderer | Two window sizes; state/action bindings; partial/error cases; keyboard access; literal rendering of hostile-looking filenames |
| Scam and link tools | Offline explanations, disguised hostnames, unsupported schemes, bounded input, tracking-parameter removal and signed-link preservation |
| Browser companion | Actual third-party request blocking and pause/resume; confirmed cookie/cache cleanup and retention of unrelated data in an isolated profile |
| Provider setup | Fixed official URLs, exact button dispatch and rejection of unsupported provider identifiers; no credentials or service enrollment |
| Companion export | Packaged files exported intact into a new folder; existing destinations are never overwritten |
| Firewall enforcement | Disposable network probe connected, failed under an owned outbound block, then connected after removal; temporary rule removed |
| Media pipeline | Actual ONNX audio/video inference; malformed media and network playlist rejected; cancellation isolated from the desktop process |
| Native guard build | x64 minifilter and ClamAV agent/service host compiled without installing or loading a driver |
| Native ClamAV bridge | Clean/empty files, harmless custom-signature detection, wrong-listener rejection and unavailable-engine errors passed |
| Kernel and service runtime | Not exercised; unsigned development components are not active protection |
| Unit/regression tests | Engine setup and cancellation, stale/missing definitions, path boundaries, quarantine authentication, replacement preservation, scan coverage and cancellation |

Reproducible test commands and scripts are checked into the repository. Detailed execution reports, timestamps, scan counts, screenshots and machine inventory remain in ignored local directories. No public test report contains personal machine data.

A real integration test found that passing an individual plaintext signature file with ClamAV's freshness flag could load zero signatures in the tested build. Production uses a database directory; the test was corrected to use the same interface. The scanner now also rejects zero or unreported loaded signatures. This is a runtime observation, not a claim about every ClamAV build. The official [clamscan option documentation](https://github.com/Cisco-Talos/clamav/blob/clamav-1.5.4/docs/man/clamscan.1.in) defines the freshness option and process return codes.

Not measured: deepfake accuracy/calibration, kernel enforcement, service restart/stop behavior, driver interoperability, malware detection rate, false-positive rate, ransomware prevention, zero-day defenses, competing product performance, or resistance to a process already controlling the Windows account. No live malware, EICAR, malicious website visits, antivirus exclusions or protection disabling were used.

The [feature comparison](PARITY.md) records the material gaps against McAfee. Functional checks do not establish equal detection accuracy or protection. Browser tests use only a local web fixture and temporary browser profile.
