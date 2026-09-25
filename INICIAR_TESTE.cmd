@echo off
setlocal
cd /d "%~dp0backend"

echo ==============================================
echo CredCasa - teste local da esteira
 echo ==============================================

if not exist node_modules (
  echo Instalando dependencias...
  call npm.cmd install
  if errorlevel 1 (
    echo.
    echo ERRO ao instalar dependencias.
    echo Verifique se Node.js e npm estao instalados.
    pause
    exit /b 1
  )
)

echo.
echo Iniciando CredCasa e os 5 microsservicos simulados...
start "CredCasa - Servidores" cmd /k "npm.cmd run local:all"

echo Aguardando os servidores iniciarem...
timeout /t 4 /nobreak >nul
start "" "http://localhost:3000/teste-api.html"

echo.
echo A pagina de teste foi aberta no navegador.
echo Deixe a janela CredCasa - Servidores aberta durante o teste.
pause
