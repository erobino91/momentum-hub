@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Lives Worker - NAO FECHAR enquanto tiver live no ar

echo ============================================
echo   LIVES WORKER
echo   Deixe esta janela aberta durante as lives.
echo   Feche (X) ou Ctrl+C quando terminar tudo.
echo ============================================
echo.

if not exist node_modules (
  echo Primeira vez: instalando dependencias...
  call npm install
  echo.
)

node index.js

echo.
echo Worker encerrado. Pode fechar.
pause
