# VirusVaccine laboratory file guard

This is a development minifilter and native ClamAV agent, **not activated protection**. The desktop application does not install either component. The driver has compiled successfully but has not been loaded or tested in a Windows kernel. The service entry point has compiled but has not been installed or exercised. Do not deploy this build on a daily-use computer.

## Implemented

- A fork of Microsoft's transaction-aware AvScan minifilter with unique VirusVaccine communication ports.
- Read/execute-open scanning restricted to `\VirusVaccineLab\` immediately beneath a volume root. It is intentionally not a system-wide policy. Write-only opens can create test fixtures.
- A mapped section carrying its exact file length to the agent, rather than scanning the page-rounded virtual-memory region. Streams are bounded to 128 MiB.
- A native INSTREAM client for the independent ClamAV daemon. It verifies that the loopback listener belongs to the expected live process ID, enforces time/size limits and accepts only explicit clean/detected responses. Missing engines, mismatched listeners and protocol errors return unknown.
- No sample-string detector or kernel fallback can return a clean verdict. Scans that fail or remain unknown deny the scoped open after the scan stage. Each eligible read-open invalidates the previous clean cache entry.
- Console and Windows service entry points, stop handling and communication with the minifilter. The agent never executes an engine path, shell command or user-supplied service configuration with elevated rights.

## Build and validate the user-mode bridge

Install Visual Studio 2022 C++ Build Tools and Windows SDK 10.0.26100.0. From the repository:

```powershell
npm run build:native
npm run verify:guard
```

The build script downloads Microsoft's pinned WDK NuGet package and verifies its SHA-256. It produces `dist/native/VirusVaccineGuard.sys` and `VirusVaccineGuardAgent.exe`. It does not register a driver, alter Secure Boot or signing policy, request elevation, or install a service. Verification requires the official ClamAV runtime in `.runtime`; it starts a disposable loopback daemon with a random harmless signature and then stops it.

The console bridge accepts `VirusVaccineGuardAgent.exe --scan PORT CLAMD_PID FILE`. Exit codes are 0 clean, 1 detected, 2 unknown/error. This verifies the native protocol, not kernel enforcement. In an isolated driver laboratory, `--listen PORT CLAMD_PID --lab-only` connects to the minifilter. The `--service` entry point accepts SCM start arguments `PORT CLAMD_PID --lab-only`; an administrator must separately supervise the correct ClamAV process. There is no production installer or daemon supervisor.

## Release gates and known gaps

1. Obtain the appropriate Microsoft hardware publishing/signing setup and a Microsoft-assigned minifilter altitude. `VirusVaccineGuard.inf.in` deliberately contains a non-installable altitude placeholder. An ordinary locally signed binary is not a production Windows kernel release.
2. Validate in a disposable Windows VM with Driver Verifier and appropriate HLK tests, including cancellation, unload, memory pressure, deadlocks, file-system types, transactions, network shares, concurrent opens, driver interoperability and recovery. No such kernel validation has yet been completed.
3. Replace the laboratory pathname scope with a reviewed production policy. Renames, hard links, alternate streams, prefetch/raw encrypted opens, existing handles, memory-mapped writes and other upstream bypass cases are not covered as a production security boundary. The sample's mapped-write issue is tracked in [upstream issue 1371](https://github.com/microsoft/Windows-driver-samples/issues/1371). Scanning at open time alone does not protect already-open mappings. Some earlier sample error/unsupported paths remain permissive.
4. Review every kernel exit path and race, scan cache and transaction semantics. Run adversarial file-mutation, service disconnect, timeout and malformed IPC tests. Compilation and user-mode bridge checks do not validate any kernel decision.
5. Implement reviewed installation, least-privilege service identities, startup/restart supervision, authenticated IPC, fresh-definition readiness and health reporting. Current ClamAV TCP is loopback only, but not authenticated: listener PID checks prevent accepting a different process; they do not prevent another local process from issuing daemon commands. This remains a production blocker.
6. Add signed updates, tamper resistance, performance/false-positive evaluation and independently measured malware efficacy. A detected file is denied by the experimental path; the driver does not automatically quarantine or delete it.

Microsoft references: [minifilters](https://learn.microsoft.com/en-us/windows-hardware/drivers/ifs/about-file-system-filter-drivers), [minifilter INF requirements](https://learn.microsoft.com/en-us/windows-hardware/drivers/ifs/creating-an-inf-file-for-a-minifilter-driver), [driver signing policy](https://learn.microsoft.com/en-us/windows-hardware/drivers/install/kernel-mode-code-signing-policy). ClamAV documents the [daemon and TCP trust boundary](https://docs.clamav.net/manual/Usage/Scanning.html#clamd).

## Provenance and license

Based on [Microsoft Windows-driver-samples / AvScan](https://github.com/microsoft/Windows-driver-samples/tree/f4c1ff842b6a0001152f44cb61788b216a1c7627/filesys/miniFilter/avscan), revision `f4c1ff842b6a0001152f44cb61788b216a1c7627`. Microsoft copyright notices are retained. This directory, including VirusVaccine modifications and additions, is licensed under **MS-PL**, reproduced in [LICENSE](LICENSE). The repository's MIT license does not replace this license.
