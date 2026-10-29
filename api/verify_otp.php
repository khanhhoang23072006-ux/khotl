<?php
require_once __DIR__ . '/_security.php';
api_headers(['POST']);

$input = json_decode(file_get_contents('php://input'), true);
$email = isset($input['email']) ? trim(strtolower($input['email'])) : '';
$otp = isset($input['otp']) ? trim($input['otp']) : '';

if (!$email || !$otp || strlen($email) > 120 || strlen($otp) > 200) {
    api_fail(400, 'Vui lòng cung cấp email và mã OTP.');
}
// Chống dò mã từ một IP: tối đa 30 lần xác thực mỗi 15 phút
$wait = rate_limit('verify-ip', client_ip(), 30, 900);
if ($wait > 0) {
    api_fail(429, 'Thử quá nhiều lần. Vui lòng thử lại sau ' . wait_text($wait) . '.', ['retry_after' => $wait]);
}

@include_once __DIR__ . '/config.php';

// Mã quản trị riêng: đặt trong api/config.php trên hosting (không đưa lên GitHub), ví dụ
//   $ADMIN_PASSCODE = 'mã-chỉ-bạn-biết';
// hoặc bản băm: $ADMIN_PASSCODE_HASH = '$2y$10$...';  (tạo bằng password_hash)
// Chưa đặt thì không có đăng nhập bằng mã quản trị, chỉ dùng OTP qua email.
$adminEmails = [
    'khanhhoang23072006@gmail.com',
    'admin@lofcreate.online',
    'admin@hust.edu.vn',
    'admin.demo@hust.edu.vn'
];
$passcode = isset($ADMIN_PASSCODE) ? (string)$ADMIN_PASSCODE : '';
$passcodeHash = isset($ADMIN_PASSCODE_HASH) ? (string)$ADMIN_PASSCODE_HASH : '';

if (in_array($email, $adminEmails) && ($passcode !== '' || $passcodeHash !== '')) {
    // Chặn dò mã: sai 5 lần trong 15 phút thì khóa 15 phút
    $lockDir = api_data_dir();
    $lockFile = $lockDir . '/admin-' . md5($email) . '.json';
    $lock = file_exists($lockFile) ? (json_decode(file_get_contents($lockFile), true) ?: []) : [];
    $now = time();
    $fails = array_values(array_filter($lock['fails'] ?? [], function ($t) use ($now) { return $t > $now - 900; }));
    $ok = $passcodeHash !== '' ? password_verify($otp, $passcodeHash) : hash_equals($passcode, $otp);
    if ($ok && count($fails) < 5) {
        @unlink($lockFile);
        echo json_encode([
            'success' => true,
            'message' => 'Đăng nhập Quản trị viên thành công!',
            'email' => $email,
            'token' => bin2hex(random_bytes(24)),
            'is_admin' => true,
            'timestamp' => $now
        ]);
        exit;
    }
    // Chỉ tính là đoán sai mã quản trị khi không phải mã OTP 6 số đang chờ
    $otpFile = $lockDir . '/' . md5($email) . '.json';
    if (!$ok && !file_exists($otpFile)) {
        $fails[] = $now;
        @file_put_contents($lockFile, json_encode(['fails' => $fails]));
    }
    if (count($fails) >= 5) {
        http_response_code(429);
        echo json_encode(['success' => false, 'message' => 'Sai quá nhiều lần. Vui lòng thử lại sau 15 phút.']);
        exit;
    }
}

$storageDir = api_data_dir();
$hashKey = md5($email);
$filePath = $storageDir . '/' . $hashKey . '.json';

if (!file_exists($filePath)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Mã xác thực không tồn tại hoặc đã hết hạn. Vui lòng yêu cầu mã mới.']);
    exit;
}

$data = json_decode(file_get_contents($filePath), true);
if (!$data || !isset($data['otp']) || !isset($data['expires_at'])) {
    @unlink($filePath);
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Dữ liệu xác thực không hợp lệ. Vui lòng thử lại.']);
    exit;
}

if (time() > $data['expires_at']) {
    @unlink($filePath);
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Mã OTP đã hết hiệu lực (quá 10 phút). Vui lòng yêu cầu mã mới.']);
    exit;
}

$data['attempts'] = ($data['attempts'] ?? 0) + 1;
if ($data['attempts'] > 5) {
    @unlink($filePath);
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Bạn đã nhập sai quá số lần cho phép. Vui lòng yêu cầu mã mới.']);
    exit;
}
file_put_contents($filePath, json_encode($data), LOCK_EX);

if (!hash_equals(trim((string)$data['otp']), $otp)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Mã xác thực không chính xác.']);
    exit;
}

// Successful verification: remove OTP file to prevent reuse
@unlink($filePath);

// Generate lightweight auth session token
$sessionToken = bin2hex(random_bytes(24));

echo json_encode([
    'success' => true,
    'message' => 'Xác thực thành công!',
    'email' => $email,
    'token' => $sessionToken,
    'is_admin' => in_array($email, $adminEmails),
    'timestamp' => time()
]);
