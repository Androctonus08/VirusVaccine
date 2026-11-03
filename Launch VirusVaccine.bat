@echo off
setlocal
set "ELECTRON_RUN_AS_NODE="
if exist "%~dp0.runtime\installed.json" set "VIRUSVACCINE_RUNTIME_DIR=%~dp0.runtime"

set "VIRUSVACCINE_EXE=%~dp0dist\VirusVaccine-0.3.0-win-x64.exe"
if exist "%VIRUSVACCINE_EXE%" goto launch
set "VIRUSVACCINE_EXE=%~dp0dist\win-unpacked\VirusVaccine.exe"
if exist "%VIRUSVACCINE_EXE%" goto launch

echo VirusVaccine has not been built in this folder.
echo Open a terminal in "%~dp0" and run: npm run dist
echo Then double-click this launcher again.
pause
exit /b 1

:launch
start "VirusVaccine" /D "%~dp0" "%VIRUSVACCINE_EXE%"
exit /b %errorlevel%
