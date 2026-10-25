<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=UTF-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Chỉ chấp nhận phương thức POST']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
$email = isset($input['email']) ? trim(strtolower($input['email'])) : '';
$otp = isset($input['otp']) ? trim($input['otp']) : '';

if (!$email || !$otp) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Vui lòng cung cấp email và mã OTP.']);
    exit;
}

// Master Admin Passcode cho tài khoản quản trị
$adminEmails = [
    'khanhhoang23072006@gmail.com',
    'admin@lofcreate.online',
    'admin@hust.edu.vn',
    'admin.demo@hust.edu.vn'
];

if (in_array($email, $adminEmails) && ($otp === '999999' || $otp === '230706')) {
    $sessionToken = bin2hex(random_bytes(24));
    echo json_encode([
        'success' => true,
        'message' => 'Đăng nhập Quản trị viên thành công!',
        'email' => $email,
        'token' => $sessionToken,
        'is_admin' => true,
        'timestamp' => time()
    ]);
    exit;
}

$storageDir = __DIR__ . '/data/otps';
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
file_put_contents($filePath, json_encode($data));

if (trim($data['otp']) !== $otp) {
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
