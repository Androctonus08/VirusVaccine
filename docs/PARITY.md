# McAfee and VirusVaccine feature comparison

**VirusVaccine 0.2.0 does not have feature or protection parity with McAfee.** It implements useful local scanning, quarantine, manual scam/link checks and a small browser privacy companion. The largest gaps are automatic prevention, threat intelligence, background service operation and the breadth of cloud-backed services. No percentage of parity or equivalent malware-detection rate is claimed.

## Basis of comparison

The comparison uses observed McAfee navigation and setup screens, public vendor documentation, review of VirusVaccine's source, and functional tests of VirusVaccine using harmless fixtures. A visible McAfee control establishes that a workflow is exposed; it does not prove its effectiveness. McAfee availability varies by plan, platform and region. This report does not identify a particular person's subscription or installed version.

McAfee documents antivirus, browser protection, privacy and identity services in its [product overview](https://www.mcafee.com/en-us/antivirus/mcafee-total-protection.html). Its [Scam Detector documentation](https://www.mcafee.com/en-us/scam-detector/) covers automatic text, email and video alerts and on-demand checks. [WebAdvisor](https://www.mcafee.com/en-us/safe-browser/mcafee-webadvisor.html) describes malware/phishing browsing protection. These vendor descriptions supply the advertised baseline; they are not independent efficacy findings.

## Comparison

“Implemented” means a VirusVaccine workflow works within the stated limits. “Partial” means materially narrower functionality. “Setup only” means the provider runs the service outside VirusVaccine. None of these labels asserts equal security effectiveness.

| Feature | McAfee baseline | VirusVaccine 0.2.0 | Assessment |
| --- | --- | --- | --- |
| Quick and custom scanning | Quick/full/custom scan workflows | Real ClamAV scanning of selected eligible files; quick scan covers Downloads, Desktop and temporary files | Implemented, different coverage and engine |
| Full-machine scanning | Full-drive scan workflow | User selects drive/folder roots; traversal, file size and archive limits are reported | Partial |
| Scan controls | Progress and pause/resume controls observed | Progress and cancellation; no pause/resume | Partial |
| Detection results and history | Results/report screens | Real detections, skips/errors, history and local JSON export | Implemented |
| Quarantine | Restore/delete workflow exposed | Confirmed AES-GCM encrypted quarantine, verified source removal, restore without overwrite | Implemented; hostile-process isolation unproven |
| Definition updates | Security update workflow | Verified upstream engine and official signatures; user-triggered updates; stale definitions block scanning | Partial; no automatic update service |
| Real-time file prevention | Continuous real-time scanning controls | Selected-folder scans after changes while app runs; execution is not blocked | Missing equivalent prevention |
| Scheduling | Recurrence/day/time controls | Daily quick scan while app is alive; no persistent Windows service or wake scheduling | Partial |
| Firewall | Outgoing connection protection and rule workflow | Read-only Windows firewall status and link to Windows settings | Missing enforcement |
| Scam messages | Automatic text/email checks and mobile setup | Manual paste, English-language warning-pattern checks; no mailbox/SMS access or trained classifier | Partial |
| Video/deepfake and QR checks | Vendor advertises video alerts and QR checks | No video, audio or QR analysis | Missing |
| Malicious-site protection | WebAdvisor malware/phishing browsing protection | Offline URL-format inspection; no reputation feed, redirect inspection or phishing blocklist | Missing equivalent protection |
| Tracker blocking | Privacy/browser feature family | Companion blocks third-party requests to twelve packaged ad/analytics domains, with pause/resume | Limited local implementation |
| Tracker cleanup | Browser and system cleanup choices observed | Explicit cookie/cache cleanup in the companion's browser profile; no history, Recycle Bin or system-temp cleanup | Partial |
| Camera/microphone privacy | Broader privacy feature family | Opens Windows permission settings; no independent device-access monitor | Settings access only |
| VPN | Integrated VPN locations/settings workflow | WireGuard setup guide and official link; provider/server required; no tunnel control or live status | Setup only, intentionally external |
| Identity monitoring | Monitored-information and breach-result workflow | HIBP email breach-notification signup guide; alerts managed externally | Setup only, intentionally external |
| Password manager | Separate password-manager setup | No password vault, autofill or synchronization | Missing |
| File shredder | File-shredding workflow | No secure-erasure feature | Missing |
| Personal-data/account cleanup | Vendor lists online privacy cleanup services | No broker-removal or online-account cleanup service | Missing |
| Tamper resistance and advanced prevention | Access-protection controls observed; vendor advertises broader threat protection | Ordinary user process; no protected service/driver or ransomware behavior shield | Missing equivalent controls |
| Mobile/multi-device management | Cross-device products and account services | Windows x64 desktop app; Chrome/Edge companion; no mobile app or device console | Missing |
| Identity restoration/support | Provider-backed services with eligibility conditions | Open-source project; no restoration, insurance or commercial response service | Missing |

## What was functionally verified

VirusVaccine's packaged desktop was exercised with an isolated application profile: actual benign ClamAV scan, scam-message explanations, query-parameter cleaning, browser-companion export with byte-for-byte verification, and exact provider URL dispatch. Renderer checks covered every page at normal and minimum window sizes, input preservation during state updates and literal rendering of untrusted text.

The browser companion was loaded into isolated Chromium. A production blocklist rule stopped a locally served request; disabling it allowed the request and enabling it blocked it again. Cache removal, cookie removal, default cookie retention, deletion confirmation and retention of unrelated local storage were checked against disposable fixtures. These checks establish the implementation works; they do not measure coverage against internet trackers or malicious websites.

Existing scanner/quarantine checks cover harmless signature detection, encryption/restore integrity, changed-file preservation, cancellations, stale definitions and incomplete scan coverage. McAfee was inspected without changing its protective settings. No destructive McAfee cleanup, VPN connection change, identity enrollment or live-malware test was performed for this comparison. A completed McAfee efficacy or performance benchmark is not available.

## Highest-impact gaps

1. Reliable background operation, signed distribution and a secure update channel.
2. On-access prevention and tamper-resistant service architecture, designed and reviewed as a separate subsystem.
3. Maintained malicious-URL intelligence with narrow browser permissions and tested false-positive handling.
4. Scam detection evaluated against labeled, consented datasets across languages and attack types.
5. Independent malware, false-positive and performance evaluation in disposable, controlled lab environments.

VPN and identity monitoring remain external by design for this release. Adding their setup pages does not count as implementing those services. Keep an established endpoint-protection product enabled alongside VirusVaccine.
