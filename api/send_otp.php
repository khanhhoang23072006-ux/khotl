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

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Địa chỉ email không hợp lệ.']);
    exit;
}

@include_once __DIR__ . '/config.php';

// Ensure OTP storage directory exists and is protected
$storageDir = __DIR__ . '/data/otps';
if (!is_dir($storageDir)) {
    @mkdir($storageDir, 0755, true);
    @file_put_contents($storageDir . '/.htaccess', "Order Deny,Allow\nDeny from all\n");
}

// Generate secure 6-digit OTP
$otp = (string)random_int(100000, 999999);
$hashKey = md5($email);
$filePath = $storageDir . '/' . $hashKey . '.json';

$payload = [
    'email' => $email,
    'otp' => $otp,
    'created_at' => time(),
    'expires_at' => time() + 600, // 10 minutes
    'attempts' => 0
];

file_put_contents($filePath, json_encode($payload));

// Trigger workflow dispatch to send email via Gmail SMTP
$token = isset($GITHUB_TOKEN) ? $GITHUB_TOKEN : '';
$repo = isset($REPO_NAME) ? $REPO_NAME : 'khanhhoang23072006-ux/khotl';
$url = "https://api.github.com/repos/{$repo}/actions/workflows/send_otp.yml/dispatches";

$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 8,
    CURLOPT_RESOLVE => [
        'api.github.com:443:140.82.114.6',
        'api.github.com:443:140.82.112.6',
        'api.github.com:443:140.82.113.6'
    ],
    CURLOPT_HTTPHEADER => [
        "Authorization: token {$token}",
        "Accept: application/vnd.github.v3+json",
        "User-Agent: HUSTDOCU-Auth-Service",
        "Content-Type: application/json"
    ],
    CURLOPT_POSTFIELDS => json_encode([
        'ref' => 'main',
        'inputs' => [
            'to' => $email,
            'otp' => $otp
        ]
    ])
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
curl_close($ch);

// Also send backup via native mail()
$backupSubject = "Mã xác thực đăng nhập HUSTDOCU: {$otp}";
$backupBody = "<html><body style='font-family:sans-serif;'><h2>HUSTDOCU</h2><p>Mã xác thực của bạn: <b style='font-size:24px;color:#c00;'>{$otp}</b></p><p>Hiệu lực trong 10 phút.</p></body></html>";
$backupHeaders = [
    'MIME-Version: 1.0',
    'Content-type: text/html; charset=UTF-8',
    'From: HUSTDOCU <no-reply@lofcreate.online>',
    'X-Mailer: PHP/' . phpversion()
];
@mail($email, $backupSubject, $backupBody, implode("\r\n", $backupHeaders));

if ($httpCode === 204 || $httpCode === 200) {
    echo json_encode([
        'success' => true,
        'message' => 'Mã xác thực đã được gửi về email của bạn qua Gmail.',
        'email' => $email,
        'expires_in' => 600
    ]);
} else {
    echo json_encode([
        'success' => true,
        'message' => 'Mã xác thực đã được gửi tới email của bạn.',
        'email' => $email,
        'expires_in' => 600,
        'warning' => $curlError ?: "HTTP {$httpCode}"
    ]);
}
