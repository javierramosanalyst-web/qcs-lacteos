@echo off
chcp 65001 >nul
rem =====================================================================
rem  Lácteos Colombia - Sistema de Control de Producción
rem  Doble clic en este archivo y se crea el acceso directo
rem  "Lacteos Colombia" en el escritorio. Al abrirlo, el sistema se ve
rem  como una aplicación propia, SIN barra de direcciones ni la IP.
rem  Si la IP del servidor cambia en la planta, edita solo la línea URL.
rem =====================================================================
set "URL=https://192.168.18.10"

set "BROWSER="
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" set "BROWSER=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not defined BROWSER if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" set "BROWSER=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if not defined BROWSER if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "BROWSER=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not defined BROWSER if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "BROWSER=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not defined BROWSER (
  echo No se encontro Microsoft Edge ni Google Chrome en este equipo.
  pause
  exit /b 1
)

powershell -NoProfile -Command "$w=New-Object -ComObject WScript.Shell; $d=[Environment]::GetFolderPath('Desktop'); $s=$w.CreateShortcut($d+'\Lacteos Colombia.lnk'); $s.TargetPath='%BROWSER%'; $s.Arguments='--app=%URL%'; $s.Description='Sistema de Control de Produccion - Lacteos Colombia'; $s.Save()"

echo Acceso directo "Lacteos Colombia" creado en el escritorio.
echo Abriendo el sistema en ventana de aplicacion (sin barra de direcciones)...
start "" "%BROWSER%" --app=%URL%
timeout /t 4 >nul
