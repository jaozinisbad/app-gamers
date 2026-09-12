@echo off
setlocal

powershell -NoProfile -WindowStyle Hidden -Command "Start-Process -FilePath 'cmd.exe' -ArgumentList '/c npm run dev' -WorkingDirectory '%~dp0server' -WindowStyle Hidden"
powershell -NoProfile -WindowStyle Hidden -Command "Start-Process -FilePath 'cmd.exe' -ArgumentList '/c ngrok http 3001' -WorkingDirectory '%~dp0' -WindowStyle Hidden"

echo API e ngrok iniciados.
echo API: http://localhost:3001
echo Os servicos foram iniciados minimizados em segundo plano.
endlocal
