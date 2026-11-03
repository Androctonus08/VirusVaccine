'use strict';
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const path = require('node:path');
const run = promisify(execFile);
async function securityStatus() {
  if (process.platform !== 'win32') return { antivirus: [], firewall: [], message: 'Windows security status is available on Windows only' };
  const script = '$ErrorActionPreference="Stop"; $a=@(Get-CimInstance -Namespace root/SecurityCenter2 -ClassName AntivirusProduct | Select-Object displayName,productState); $f=@(Get-NetFirewallProfile | Select-Object Name,Enabled); @{antivirus=$a;firewall=$f}|ConvertTo-Json -Depth 4 -Compress';
  try {
    const powershell = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
    const { stdout } = await run(powershell, ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], { windowsHide: true, timeout: 20000, maxBuffer: 128 * 1024 });
    const data = JSON.parse(stdout);
    return { antivirus: data.antivirus.map(x => ({ name: x.displayName, productState: x.productState })), firewall: data.firewall.map(x => ({ name: x.Name, enabled: x.Enabled === true || x.Enabled === 1 })), message: 'Registered antivirus products and Windows firewall settings. Registration does not prove current protection.' };
  } catch { return { antivirus: [], firewall: [], message: 'Windows security status could not be read. Open Windows Security to check.' }; }
}
module.exports = { securityStatus };
