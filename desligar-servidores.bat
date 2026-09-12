@echo off
setlocal

for /f %%P in ('powershell -NoProfile -Command "(Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue).OwningProcess"') do taskkill /PID %%P /T /F >nul 2>&1
taskkill /IM ngrok.exe /T /F >nul 2>&1

echo API e ngrok encerrados.
pause
endlocal
