@echo off
setlocal enabledelayedexpansion

set COMMAND=%1

if "%COMMAND%"=="" goto :missing_param
if "%COMMAND%"=="up" goto :do_up
if "%COMMAND%"=="down" goto :do_down
if "%COMMAND%"=="package" goto :do_package

goto :invalid_param

:do_up
echo Starting services (docker compose up -d) ...
docker compose up -d
goto :done

:do_down
echo Stopping and removing containers (docker compose down) ...
docker compose down
goto :done

:do_package
echo Starting package: theme -^> Jasmine ...
set SRC_DIR=theme
set DEST_DIR=Jasmine
set OUTPUT_FILE=Jasmine.zip

if not exist "%SRC_DIR%\" (
    echo Error: Directory %SRC_DIR% does not exist!
    exit /b 1
)

if exist "%OUTPUT_FILE%" del /q "%OUTPUT_FILE%"

if not exist "%DEST_DIR%" mkdir "%DEST_DIR%"

echo Copying theme -^> Jasmine ...
robocopy "%SRC_DIR%" "%DEST_DIR%" /E /NFL /NDL /NJH /NJS /XD .git node_modules /XF .DS_Store *.log

if errorlevel 8 (
    echo Error: File copy failed!
    exit /b 1
)

echo Creating archive: %OUTPUT_FILE%

where powershell >nul 2>&1
if %errorlevel% equ 0 (
    powershell -Command "Compress-Archive -Path '%DEST_DIR%\*' -DestinationPath '%OUTPUT_FILE%' -Force"
) else (
    echo Error: Compression tool not found
    exit /b 1
)

if exist "%DEST_DIR%" rmdir /s /q "%DEST_DIR%"

echo Package completed: %OUTPUT_FILE%

for %%A in ("%OUTPUT_FILE%") do (
    set SIZE=%%~zA
    echo File size: !SIZE! bytes
)

goto :done

:missing_param
echo Error: Missing parameter
echo Usage:
echo   %0 up      -  docker compose up -d
echo   %0 down    -  docker compose down  
echo   %0 package -  Package theme into Jasmine.zip
exit /b 1

:invalid_param
echo Unsupported parameter: %COMMAND%
echo Available commands: up / down / package
exit /b 1

:done
echo Operation completed successfully
endlocal
