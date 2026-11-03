$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$vswhere = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\Installer\vswhere.exe'
$vs = & $vswhere -latest -products '*' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
if (!$vs) { throw 'Install Visual Studio C++ Build Tools and Windows SDK 10.0.26100.0 first.' }
$vc = Get-ChildItem -LiteralPath (Join-Path $vs 'VC\Tools\MSVC') -Directory | Sort-Object Name -Descending | Select-Object -First 1 -ExpandProperty FullName
$sdk = Join-Path ${env:ProgramFiles(x86)} 'Windows Kits\10'
$kitVersion = '10.0.26100.0'
if (!(Test-Path -LiteralPath "$sdk\Include\$kitVersion\um\Windows.h")) { throw 'Windows SDK 10.0.26100.0 is required.' }
$wdk = Join-Path $repo '.tools\wdk'
$archive = Join-Path $wdk 'wdk.nupkg'
$expected = 'c393d03dfb640b5c92f546b32f6770ef68cd3aaf691956e7d66d8e2c28a1b55e'
New-Item -ItemType Directory -Force -Path $wdk | Out-Null
if (!(Test-Path -LiteralPath $archive)) {
    Invoke-WebRequest -UseBasicParsing -Uri 'https://api.nuget.org/v3-flatcontainer/microsoft.windows.wdk.x64/10.0.26100.6584/microsoft.windows.wdk.x64.10.0.26100.6584.nupkg' -OutFile $archive
}
if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expected) { throw 'WDK archive verification failed.' }
if (!(Test-Path -LiteralPath "$wdk\package\c\Include\$kitVersion\km\fltKernel.h")) {
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [IO.Compression.ZipFile]::ExtractToDirectory($archive,"$wdk\package")
}
$kit = "$wdk\package\c"
$out = Join-Path $repo 'dist\native'
New-Item -ItemType Directory -Force -Path $out | Out-Null
$cl = "$vc\bin\Hostx64\x64\cl.exe"
$link = "$vc\bin\Hostx64\x64\link.exe"
$common = @('/nologo','/c','/W3','/O2','/GS','/D_AMD64_','/DAMD64','/DUNICODE','/D_UNICODE','/D_WIN32_WINNT=0x0A00','/DWINVER=0x0A00',"/I$repo\native\guard\inc", "/I$sdk\Include\$kitVersion\shared")
$kernel = @('/kernel','/Zl','/Dtry=__try','/Dexcept=__except','/Dfinally=__finally','/Dleave=__leave','/DNTDDI_VERSION=0x0A00000C',"/I$kit\Include\$kitVersion\km", "/I$kit\Include\$kitVersion\km\crt", "/I$vc\include", "/I$sdk\Include\$kitVersion\ucrt")
$objects = @()
foreach ($source in @('avscan','communication','context','csvfs','scan','utility')) {
    $object = "$out\filter-$source.obj"
    & $cl @common @kernel "/Fo$object" "$repo\native\guard\filter\$source.c"
    if ($LASTEXITCODE) { throw "Kernel compilation failed: $source" }
    $objects += $object
}
& $link /NOLOGO /DRIVER /SUBSYSTEM:NATIVE /ENTRY:GsDriverEntry /NODEFAULTLIB /MACHINE:X64 /DYNAMICBASE /NXCOMPAT /INTEGRITYCHECK "/OUT:$out\VirusVaccineGuard.sys" "/LIBPATH:$kit\Lib\$kitVersion\km\x64" @objects fltMgr.lib ntoskrnl.lib hal.lib BufferOverflowK.lib
if ($LASTEXITCODE) { throw 'Kernel link failed' }
$objects = @()
foreach ($source in @('agent','clambridge','userscan','utility')) {
    $object = "$out\user-$source.obj"
    & $cl @common /MT "/I$vc\include" "/I$sdk\Include\$kitVersion\um" "/I$sdk\Include\$kitVersion\ucrt" "/Fo$object" "$repo\native\guard\user\$source.c"
    if ($LASTEXITCODE) { throw "Agent compilation failed: $source" }
    $objects += $object
}
& $link /NOLOGO /SUBSYSTEM:CONSOLE /MACHINE:X64 /DYNAMICBASE /NXCOMPAT "/OUT:$out\VirusVaccineGuardAgent.exe" "/LIBPATH:$vc\lib\x64" "/LIBPATH:$sdk\Lib\$kitVersion\um\x64" "/LIBPATH:$sdk\Lib\$kitVersion\ucrt\x64" @objects fltLib.lib kernel32.lib advapi32.lib ws2_32.lib iphlpapi.lib
if ($LASTEXITCODE) { throw 'Agent link failed' }
Write-Output 'Built unsigned laboratory driver and console agent. No driver was installed or activated.'
