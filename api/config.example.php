<?php
// Mẫu cấu hình máy chủ. Trên hosting, sửa file api/config.php (KHÔNG đưa file đó lên GitHub).

// Gửi email mã OTP trực tiếp qua SMTP (nhanh nhất, thư tới sau vài giây). Với Gmail:
//   1. Bật xác minh 2 bước cho tài khoản Gmail gửi thư
//   2. Tạo mật khẩu ứng dụng 16 ký tự tại https://myaccount.google.com/apppasswords
//   3. Điền vào đây (chỉ trong api/config.php trên hosting)
$SMTP_HOST = 'smtp.gmail.com';
$SMTP_PORT = 465;           // 465 = SSL; nếu hosting chặn cổng 465 thì thử 587
$SMTP_USER = '';            // ví dụ hustdocu.otp@gmail.com
$SMTP_PASS = '';            // mật khẩu ứng dụng 16 ký tự, không phải mật khẩu Gmail
$SMTP_FROM_NAME = 'HUSTDOCU';

// Dự phòng khi SMTP lỗi: token GitHub (fine-grained, chỉ repo khotl, quyền Actions: Read and write)
// để gọi workflow gửi email OTP (send_otp.yml). Thư qua đường này chậm hơn 20-60 giây.
$GITHUB_TOKEN = '';
$REPO_NAME = 'khanhhoang23072006-ux/khotl';

// Máy chủ TURN cho voice chat phòng học (giúp người dùng 4G, mạng trường nối được với nhau).
// Để trống thì chỉ dùng STUN miễn phí. Ví dụ dịch vụ có gói miễn phí: metered.ca (Open Relay), Cloudflare Calls TURN.
$TURN_URLS = '';            // ví dụ 'turn:global.relay.metered.ca:80,turn:global.relay.metered.ca:443?transport=tcp,turns:global.relay.metered.ca:443?transport=tcp'
$TURN_USERNAME = '';
$TURN_CREDENTIAL = '';
// Hoặc nếu tự chạy coturn với use-auth-secret: đặt $TURN_SECRET, máy chủ sẽ cấp mật khẩu tạm 6 giờ cho từng người
$TURN_SECRET = '';

// Mã quản trị: chỉ người quản trị biết, dùng để đăng nhập các email quản trị khi không nhận được OTP.
// Đặt mã dài, khó đoán. Để trống thì tắt chức năng này.
$ADMIN_PASSCODE = '';
// Hoặc lưu bản băm thay cho mã gốc (ưu tiên nếu có): $ADMIN_PASSCODE_HASH = password_hash('mã', PASSWORD_DEFAULT);
