<?php
require_once __DIR__ . '/_security.php';
api_headers(['POST']);

$input = json_decode(file_get_contents('php://input'), true);
$email = isset($input['email']) ? trim(strtolower($input['email'])) : '';

if (strlen($email) > 120 || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    api_fail(400, 'Địa chỉ email không hợp lệ.');
}

// Chống lạm dụng gửi mail (spam người khác, dò mã OTP): mỗi email 1 lần/60 giây và 5 lần/giờ; mỗi IP 15 lần/giờ
foreach ([['otp-mail-1m', $email, 1, 60], ['otp-mail-1h', $email, 5, 3600], ['otp-ip-1h', client_ip(), 15, 3600]] as $r) {
    $wait = rate_limit($r[0], $r[1], $r[2], $r[3]);
    if ($wait > 0) {
        api_fail(429, 'Bạn yêu cầu mã quá nhiều lần. Vui lòng thử lại sau ' . wait_text($wait) . '.', ['retry_after' => $wait]);
    }
}

@include_once __DIR__ . '/config.php';

$storageDir = api_data_dir();

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

file_put_contents($filePath, json_encode($payload), LOCK_EX);

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

if ($httpCode !== 204 && $httpCode !== 200) {
    // Ghi lỗi vào log máy chủ, không trả chi tiết cho người dùng
    error_log('send_otp: workflow dispatch failed: ' . ($curlError ?: "HTTP {$httpCode}"));
}
echo json_encode([
    'success' => true,
    'message' => 'Mã xác thực đã được gửi tới email của bạn.',
    'email' => $email,
    'expires_in' => 600
]);
