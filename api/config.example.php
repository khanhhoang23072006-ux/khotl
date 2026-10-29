<?php
// Mẫu cấu hình máy chủ. Trên hosting, sửa file api/config.php (KHÔNG đưa file đó lên GitHub).

// Token GitHub để gọi workflow gửi email OTP (send_otp.yml)
$GITHUB_TOKEN = '';
$REPO_NAME = 'khanhhoang23072006-ux/khotl';

// Mã quản trị: chỉ người quản trị biết, dùng để đăng nhập các email quản trị khi không nhận được OTP.
// Đặt mã dài, khó đoán. Để trống thì tắt chức năng này.
$ADMIN_PASSCODE = '';
// Hoặc lưu bản băm thay cho mã gốc (ưu tiên nếu có): $ADMIN_PASSCODE_HASH = password_hash('mã', PASSWORD_DEFAULT);
