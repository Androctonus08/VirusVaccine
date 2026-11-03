'use strict';
// Requires a standard Windows UAC approval. Uses only a disposable probe and owned rule.
const {randomUUID}=require('node:crypto'),path=require('node:path'),fs=require('node:fs/promises');
const firewall=require('../src/main/firewall.cjs');
(async()=>{
  const id='VirusVaccine.App.'+randomUUID(),dir=path.join(process.env.ProgramData,'VVFirewallProbe-'+randomUUID());
  const exe=path.join(dir,'NetworkProbe.exe'),q=x=>"'"+x.replaceAll("'","''")+"'";
  const create=firewall.addScript(exe,id).replace('; exit 0',''),remove=firewall.removeScript(id).replace('; exit 0','');
  const script=`$ErrorActionPreference='Stop'; $dir=${q(dir)}; $exe=${q(exe)};
if(Test-Path -LiteralPath $dir){throw 'Probe directory already exists'}
New-Item -ItemType Directory -Path $dir | Out-Null;
$acl=New-Object Security.AccessControl.DirectorySecurity;
$acl.SetAccessRuleProtection($true,$false);
foreach($sid in @('S-1-5-18','S-1-5-32-544')){ $identity=New-Object Security.Principal.SecurityIdentifier($sid);$acl.AddAccessRule((New-Object Security.AccessControl.FileSystemAccessRule($identity,'FullControl','ContainerInherit,ObjectInherit','None','Allow'))) };
$users=New-Object Security.Principal.SecurityIdentifier('S-1-5-32-545');$acl.AddAccessRule((New-Object Security.AccessControl.FileSystemAccessRule($users,'ReadAndExecute','ContainerInherit,ObjectInherit','None','Allow')));Set-Acl -LiteralPath $dir -AclObject $acl;
$report=@{passed=$false;baseline=$false;blocked=$false;restored=$false;ruleRemoved=$false};
try {
  $source=Join-Path $env:SystemRoot 'System32\\curl.exe';
  if(!(Test-Path -LiteralPath $source)){throw 'Windows curl is unavailable'};
  Copy-Item -LiteralPath $source -Destination $exe -ErrorAction Stop;
  if((Get-FileHash -LiteralPath $source).Hash -ne (Get-FileHash -LiteralPath $exe).Hash){throw 'Probe copy mismatch'};
  function Probe { $p=Start-Process -FilePath $exe -ArgumentList @('--silent','--fail','--head','--connect-timeout','4','--max-time','6','--noproxy','*','https://1.1.1.1/') -WindowStyle Hidden -PassThru -Wait; return ($p.ExitCode -eq 0) }
  $report.baseline=Probe;if(!$report.baseline){throw 'Baseline connection failed'};
  ${create}; Start-Sleep -Milliseconds 750;
  $report.blocked=!(Probe);if(!$report.blocked){throw 'Outbound connection was not blocked'};
  ${remove};Start-Sleep -Milliseconds 750;
  $report.restored=Probe;if(!$report.restored){throw 'Connection did not recover after removing rule'};
  $report.passed=$true;
} catch { $report.error=$_.Exception.Message }
finally {
  $r=Get-NetFirewallRule -Name ${q(id)} -ErrorAction SilentlyContinue;if($r -and $r.Group -eq 'VirusVaccine application controls'){$r|Remove-NetFirewallRule -ErrorAction Stop};
  $report.ruleRemoved=!(Get-NetFirewallRule -Name ${q(id)} -ErrorAction SilentlyContinue);
  if(Test-Path -LiteralPath $exe){Remove-Item -LiteralPath $exe -Force};
  $report|ConvertTo-Json|Set-Content -LiteralPath (Join-Path $dir 'result.json') -Encoding UTF8;
}
exit 0`;
  const result=await firewall.elevate(script);if(result.cancelled){console.log('UAC cancelled; enforcement not tested.');process.exitCode=2;return;}
  const report=JSON.parse((await fs.readFile(path.join(dir,'result.json'),'utf8')).replace(/^\uFEFF/,''));
  await fs.mkdir(path.resolve(__dirname,'../review/private'),{recursive:true});await fs.writeFile(path.resolve(__dirname,'../review/private/firewall-verification.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report));if(!report.passed||!report.ruleRemoved)process.exitCode=1;
})().catch(error=>{console.error(error.message);process.exitCode=1});
