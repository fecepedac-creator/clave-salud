@echo off
echo ==========================================
echo      CLAVE SALUD - DEPLOY TO PRODUCTION
echo ==========================================

echo [1/3] Saving changes to Git...
git add .
git commit -m "Deploy: Admin Dashboard fixes and Kinesiology Report"

echo [2/3] Building production version...
call npm run build
if %errorlevel% neq 0 (
    echo Error during build!
    pause
    exit /b %errorlevel%
)

echo [3/3] Deploying to Firebase Hosting...
call npx --yes -p firebase-tools firebase deploy
if %errorlevel% neq 0 (
    echo Error during deploy!
    echo Ensure you are logged in with 'npx firebase login'
    pause
    exit /b %errorlevel%
)

echo ==========================================
echo      DEPLOYMENT SUCCESSFUL
echo ==========================================
pause
