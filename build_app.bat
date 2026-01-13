@echo off
echo Installing dependencies...
call npm install

echo Building Windows executable...
call npm run dist

if %errorlevel% neq 0 (
    echo Build failed!
    pause
    exit /b %errorlevel%
)

echo Build successful! The executable is located in the 'dist' folder.
