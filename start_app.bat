@echo off
setlocal enabledelayedexpansion

echo =========================================
echo Starting DLMS Meter Application...
echo =========================================

:: Check if Docker is running
docker info >nul 2>&1
if !errorlevel! neq 0 (
    echo Docker Desktop is not running. Attempting to start Docker Desktop...
    :: Start Docker Desktop (this path is standard for Windows)
    start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    
    echo Waiting for Docker to initialize...
    :wait_docker
    docker info >nul 2>&1
    if !errorlevel! neq 0 (
        timeout /t 5 /nobreak >nul
        goto wait_docker
    )
    echo Docker started successfully.
)

echo Starting database services...
docker-compose up -d
set COMPOSE_EXIT_CODE=%errorlevel%

timeout /t 5 /nobreak >nul

if %COMPOSE_EXIT_CODE% equ 0 (
    echo =========================================
    echo Databases started. Launching the backend service...
    echo =========================================
    
    :: Start the backend executable in a new MINIMIZED window
    :: Use %~dp0 to ensure we are relative to the script location
    start "" /MIN "%~dp0dlms_meter_be\dist\run\run.exe" serve

    echo Waiting for the backend to be ready at http://localhost:8000...
    
    :wait_backend
    curl -s http://localhost:8000/api/serial >nul 2>&1
    if !errorlevel! neq 0 (
        timeout /t 2 /nobreak >nul
        goto wait_backend
    )

    echo =========================================
    echo Application is READY!
    echo Automatically opening your browser...
    echo =========================================
    
    :: Open the default browser
    start http://localhost:8000

    echo The application is running in the background.
) else (
    echo =========================================
    echo CRITICAL ERROR: Failed to start database services.
    echo Please ensure Docker Desktop is running and healthy.
    echo =========================================
    pause
)
