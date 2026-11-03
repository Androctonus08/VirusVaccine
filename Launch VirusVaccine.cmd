@echo off
setlocal
set "ELECTRON_RUN_AS_NODE="
if exist "%~dp0.runtime\installed.json" set "VIRUSVACCINE_RUNTIME_DIR=%~dp0.runtime"
if not exist "%~dp0dist\VirusVaccine-0.2.0-win-x64.exe" (
  echo Build the Windows application first with npm run dist.
  exit /b 1
)
start "VirusVaccine" "%~dp0dist\VirusVaccine-0.2.0-win-x64.exe"
