'use strict';
const {ps}=require('./firewall.cjs');
async function status(){
  let driver='Unknown',agent='Unknown';
  try{const data=JSON.parse(await ps("$d=Get-CimInstance Win32_SystemDriver -Filter \"Name='VirusVaccineGuard'\" -ErrorAction SilentlyContinue; $a=Get-Service -Name VirusVaccineGuardAgent -ErrorAction SilentlyContinue; @{driver=if($d){$d.State}else{'Not installed'};agent=if($a){$a.Status.ToString()}else{'Not installed'}}|ConvertTo-Json -Compress"));driver=data.driver;agent=data.agent;}catch{}
  return{active:false,driver,agent,stage:'Laboratory implementation',message:'The driver and ClamAV agent are development components. This desktop release does not install or activate real-time file blocking. Microsoft signing, an assigned filter altitude, isolated Windows testing and production hardening are still required.'};
}
module.exports={status};
