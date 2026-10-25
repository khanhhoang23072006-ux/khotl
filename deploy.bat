@echo off
echo ==============================================
echo   DANG DONG BO ^& UPLOAD TOAN BO LEN WEBSITE
echo   Hosting: 103.97.126.29 (lofcreate.online)
echo ==============================================

set FTP=ftp://103.97.126.29/domains/lofcreate.online/public_html
set AUTH=--user tgxaumkw:DUtmg1g7d0

echo [1/11] Uploading index.html...
curl.exe -s -T "index.html" "%FTP%/index.html" %AUTH%

echo [2/11] Uploading sw.js...
curl.exe -s -T "sw.js" "%FTP%/sw.js" %AUTH%

echo [3/11] Uploading manifest.webmanifest...
curl.exe -s -T "manifest.webmanifest" "%FTP%/manifest.webmanifest" %AUTH%

echo [4/11] Uploading api/send_otp.php...
curl.exe -s -T "api\send_otp.php" --ftp-create-dirs "%FTP%/api/send_otp.php" %AUTH%

echo [5/11] Uploading api/verify_otp.php...
curl.exe -s -T "api\verify_otp.php" --ftp-create-dirs "%FTP%/api/verify_otp.php" %AUTH%

echo [6/11] Uploading api/data/otps/.htaccess...
curl.exe -s -T "api\data\otps\.htaccess" --ftp-create-dirs "%FTP%/api/data/otps/.htaccess" %AUTH%

echo [7/11] Uploading data/hust-feed.json...
curl.exe -s -T "data\hust-feed.json" --ftp-create-dirs "%FTP%/data/hust-feed.json" %AUTH%

echo [8/11] Uploading icons/icon.svg...
curl.exe -s -T "icons\icon.svg" --ftp-create-dirs "%FTP%/icons/icon.svg" %AUTH%

echo [9/11] Uploading icons/icon-192.png...
curl.exe -s -T "icons\icon-192.png" --ftp-create-dirs "%FTP%/icons/icon-192.png" %AUTH%

echo [10/11] Uploading icons/icon-512.png...
curl.exe -s -T "icons\icon-512.png" --ftp-create-dirs "%FTP%/icons/icon-512.png" %AUTH%

echo [11/11] Uploading icons/og.png...
curl.exe -s -T "icons\og.png" --ftp-create-dirs "%FTP%/icons/og.png" %AUTH%

echo.
echo ==============================================
echo   DA CAP NHAT THANH CONG TOAN BO!
echo   Truy cap ngay: http://lofcreate.online
echo ==============================================
