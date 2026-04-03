@echo off
REM Build Tracking App APK Locally

echo Building Android project...
echo This will take 10-15 minutes on first build

REM Install dependencies
echo Step 1: Installing dependencies...
call npm install

REM Prebuild Android
echo Step 2: Prebuilding Android project...
call npx expo prebuild --platform android --clean --no-install

REM Check if Gradle wrapper exists
if not exist "android\gradlew.bat" (
    echo Error: Gradle wrapper not found
    echo Installing Android build tools...
    exit /b 1
)

REM Build APK
echo Step 3: Building APK with Gradle...
cd android
call gradlew.bat assembleRelease
cd ..

REM Check if build succeeded
if exist "android\app\build\outputs\apk\release\app-release.apk" (
    echo.
    echo ✅ SUCCESS! APK built at:
    echo android\app\build\outputs\apk\release\app-release.apk
    echo.
    pause
) else (
    echo.
    echo ❌ Build failed. Check error messages above.
    echo.
    pause
)
