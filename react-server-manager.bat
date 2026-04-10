@echo off
setlocal enabledelayedexpansion
title AccountantOS Dev Server Manager
cd /d "%~dp0"

:menu
cls
echo.
echo  ============================================
echo    AccountantOS  ^|  Dev Server Manager
echo  ============================================
echo.

:: Node / npm versions
for /f "tokens=*" %%v in ('node --version 2^>nul') do set "NODE_VER=%%v"
for /f "tokens=*" %%v in ('npm  --version 2^>nul') do set "NPM_VER=%%v"
if defined NODE_VER (
    echo  Node !NODE_VER!   npm v!NPM_VER!
) else (
    echo  [!] Node.js not found ^- install from https://nodejs.org
)

:: Detect server via port 5173
set "SERVER_PID="
for /f "tokens=5" %%p in ('netstat -ano 2^>nul ^| findstr /r ":5173 "') do (
    if not defined SERVER_PID set "SERVER_PID=%%p"
)

echo.
if defined SERVER_PID (
    echo  Status : RUNNING  ^(PID !SERVER_PID!^)  -  http://localhost:5173
) else (
    echo  Status : STOPPED
)
echo.
echo  [1] Start dev server
echo  [2] Stop server
echo  [3] Restart server
echo  [4] Open browser
echo  [5] Install / update packages
echo  [6] Build for production
echo  [7] Exit
echo.
set /p "CHOICE=  Select option [1-7]: "

if "!CHOICE!"=="1" goto :start
if "!CHOICE!"=="2" goto :stop
if "!CHOICE!"=="3" goto :restart
if "!CHOICE!"=="4" goto :openbrowser
if "!CHOICE!"=="5" goto :install
if "!CHOICE!"=="6" goto :build
if "!CHOICE!"=="7" exit /b 0
goto :menu

:: ?? START ????????????????????????????????????????????????????
:start
cls
if defined SERVER_PID (
    echo  Server is already running on http://localhost:5173 ^(PID !SERVER_PID!^)
    echo  Use option [3] to restart.
    pause
    goto :menu
)
if not exist "node_modules\" (
    echo  node_modules not found. Running npm install first...
    echo.
    npm install
    if errorlevel 1 (
        echo.
        echo  [!] npm install failed. Fix the errors above and try again.
        pause
        goto :menu
    )
    echo.
)
echo  Starting AccountantOS dev server in a new window...
start "AccountantOS Dev Server" cmd /k "npm run dev"
timeout /t 4 /nobreak >nul
echo  Server started!
echo.
start "" "http://localhost:5173"
echo  Browser opened at http://localhost:5173
echo  ^(Close the "AccountantOS Dev Server" window to stop the server^)
echo.
pause
goto :menu

:: ?? STOP ?????????????????????????????????????????????????????
:stop
cls
if not defined SERVER_PID (
    echo  No server is running on port 5173.
    pause
    goto :menu
)
echo  Stopping server ^(PID !SERVER_PID!^)...
taskkill /PID !SERVER_PID! /F >nul 2>&1
timeout /t 1 /nobreak >nul
echo  Server stopped.
pause
goto :menu

:: ?? RESTART ??????????????????????????????????????????????????
:restart
cls
if defined SERVER_PID (
    echo  Stopping server ^(PID !SERVER_PID!^)...
    taskkill /PID !SERVER_PID! /F >nul 2>&1
    timeout /t 2 /nobreak >nul
    set "SERVER_PID="
)
echo  Starting AccountantOS dev server...
start "AccountantOS Dev Server" cmd /k "npm run dev"
timeout /t 4 /nobreak >nul
echo  Server restarted!
start "" "http://localhost:5173"
pause
goto :menu

:: ?? OPEN BROWSER ?????????????????????????????????????????????
:openbrowser
start "" "http://localhost:5173"
goto :menu

:: ?? INSTALL ??????????????????????????????????????????????????
:install
cls
echo  Installing / updating dependencies...
echo.
npm install
if errorlevel 1 (
    echo.
    echo  [!] npm install failed.
) else (
    echo.
    echo  Done! All packages are up to date.
)
pause
goto :menu

:: ?? BUILD ????????????????????????????????????????????????????
:build
cls
echo  Building AccountantOS for production...
echo.
npm run build
if errorlevel 1 (
    echo.
    echo  [!] Build failed. See errors above.
) else (
    echo.
    echo  Build complete! Output is in the .\dist\ folder.
    echo  Run "npm run preview" to preview locally.
)
pause
goto :menu
