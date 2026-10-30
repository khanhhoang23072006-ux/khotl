@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"

echo ==============================================
echo   DONG BO ^& UPLOAD WEBSITE LEN HOSTING
echo ==============================================

rem Thong tin FTP doc tu deploy.local.bat (chi nam tren may ban, KHONG dua len GitHub).
if not exist "deploy.local.bat" (
  copy /y "deploy.local.example.bat" "deploy.local.bat" >nul
  echo.
  echo [!] Da tao file deploy.local.bat. Mo file do, dien FTP_USER va FTP_PASS
  echo     ^(lay trong trang quan ly hosting^), luu lai roi chay lai deploy.bat.
  start "" notepad "deploy.local.bat"
  pause
  exit /b 1
)
call "deploy.local.bat"
if "%FTP_HOST%"=="" goto :missing
if "%FTP_USER%"=="" goto :missing
if "%FTP_PASS%"=="" goto :missing
if "%FTP_DIR%"=="" set "FTP_DIR=/domains/lofcreate.online/public_html"
if "%SITE_URL%"=="" set "SITE_URL=http://lofcreate.online"

set "FTP=ftp://%FTP_HOST%%FTP_DIR%"
set "FAIL=0"

call :up ".htaccess" ".htaccess"
call :up "index.html" "index.html"
call :up "sw.js" "sw.js"
call :up "manifest.webmanifest" "manifest.webmanifest"
call :up "api\_security.php" "api/_security.php"
call :up "api\_mailer.php" "api/_mailer.php"
call :up "api\send_otp.php" "api/send_otp.php"
call :up "api\verify_otp.php" "api/verify_otp.php"
call :up "api\voice_signal.php" "api/voice_signal.php"
call :up "api\extensions.php" "api/extensions.php"
call :up "api\data\.htaccess" "api/data/.htaccess"
call :up "api\data\otps\.htaccess" "api/data/otps/.htaccess"
call :up "data\hust-feed.json" "data/hust-feed.json"
call :up "icons\icon.svg" "icons/icon.svg"
call :up "icons\icon-192.png" "icons/icon-192.png"
call :up "icons\icon-512.png" "icons/icon-512.png"
call :up "icons\og.png" "icons/og.png"

echo.
echo ==============================================
if "%FAIL%"=="0" (
  echo   DA CAP NHAT THANH CONG!
  echo   Truy cap: %SITE_URL%
) else (
  echo   CO FILE UPLOAD LOI. Kiem tra FTP_USER, FTP_PASS trong deploy.local.bat
  echo   va ket noi mang roi chay lai.
)
echo ==============================================
echo   Luu y: api\config.php ^(token GitHub, ma quan tri^) KHONG upload tu day,
echo   sua truc tiep tren hosting.
pause
exit /b %FAIL%

rem ---- Upload mot file: %1 duong dan tren may, %2 duong dan tren hosting ----
:up
if not exist "%~1" (
  echo  - Bo qua %~1 ^(khong co tren may^)
  exit /b 0
)
echo  - %~2
curl.exe -s -S --fail --ftp-create-dirs --user "%FTP_USER%:%FTP_PASS%" -T "%~1" "%FTP%/%~2"
if errorlevel 1 (
  echo    LOI: khong upload duoc %~2
  set "FAIL=1"
)
exit /b 0

:missing
echo [!] deploy.local.bat chua dien du FTP_HOST, FTP_USER, FTP_PASS.
start "" notepad "deploy.local.bat"
pause
exit /b 1
