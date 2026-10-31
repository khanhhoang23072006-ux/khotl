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
require_once __DIR__ . '/_mailer.php';

$storageDir = api_data_dir();

// Mã 6 số ngẫu nhiên an toàn; trên máy chủ chỉ lưu bản băm (lộ thư mục dữ liệu cũng không đọc được mã)
$otp = (string)random_int(100000, 999999);
$filePath = $storageDir . '/' . md5($email) . '.json';
$payload = [
    'email' => $email,
    'otp_hash' => hash_hmac('sha256', $otp, $email),
    'created_at' => time(),
    'expires_at' => time() + 600, // 10 phút
    'attempts' => 0
];
file_put_contents($filePath, json_encode($payload), LOCK_EX);

[$subject, $text, $html] = otp_mail_content($otp);
$errors = [];
$sentVia = '';

// 1. SMTP trực tiếp từ hosting (nhanh nhất, thư tới sau vài giây). Cấu hình $SMTP_USER, $SMTP_PASS trong api/config.php
if (!empty($SMTP_USER) && !empty($SMTP_PASS)) {
    try {
        smtp_send([
            'host' => $SMTP_HOST ?? 'smtp.gmail.com',
            'port' => $SMTP_PORT ?? 465,
            'secure' => $SMTP_SECURE ?? (($SMTP_PORT ?? 465) == 465 ? 'ssl' : 'tls'),
            'user' => $SMTP_USER,
            'pass' => $SMTP_PASS,
            'from' => $SMTP_FROM ?? $SMTP_USER,
            'from_name' => $SMTP_FROM_NAME ?? 'HUSTDOCU',
        ], $email, $subject, $text, $html);
        $sentVia = 'smtp';
    } catch (Throwable $e) {
        $errors[] = 'smtp: ' . $e->getMessage();
    }
}

// 2. Dự phòng: nhờ GitHub Actions gửi (workflow send_otp.yml, chậm hơn 20-60 giây)
if ($sentVia === '' && !empty($GITHUB_TOKEN)) {
    $repo = !empty($REPO_NAME) ? $REPO_NAME : 'khanhhoang23072006-ux/khotl';
    $dispatch = function (array $extra) use ($repo, $GITHUB_TOKEN, $email, $otp) {
        $ch = curl_init("https://api.github.com/repos/{$repo}/actions/workflows/send_otp.yml/dispatches");
        curl_setopt_array($ch, $extra + [
            CURLOPT_POST => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_TIMEOUT => 10,
            CURLOPT_HTTPHEADER => [
                "Authorization: Bearer {$GITHUB_TOKEN}",
                'Accept: application/vnd.github+json',
                'X-GitHub-Api-Version: 2022-11-28',
                'User-Agent: HUSTDOCU-Auth-Service',
                'Content-Type: application/json'
            ],
            CURLOPT_POSTFIELDS => json_encode(['ref' => 'main', 'inputs' => ['to' => $email, 'otp' => $otp]])
        ]);
        $body = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err = curl_error($ch);
        curl_close($ch);
        return [$code, $err, is_string($body) ? substr($body, 0, 200) : ''];
    };
    [$code, $err, $body] = $dispatch([]);
    if ($code === 0) {
        // Một số hosting phân giải DNS api.github.com lỗi: thử lại bằng IP cố định của GitHub
        [$code, $err, $body] = $dispatch([CURLOPT_RESOLVE => ['api.github.com:443:140.82.112.6', 'api.github.com:443:140.82.113.6', 'api.github.com:443:140.82.114.6']]);
    }
    if ($code === 204) {
        $sentVia = 'github';
    } else {
        // 401: token sai/hết hạn; 403: token thiếu quyền Actions; 404: sai tên repo hoặc workflow
        $errors[] = 'github: ' . ($err ?: "HTTP {$code} {$body}");
    }
}

// 3. Dự phòng cuối: hàm mail() của hosting (hay bị xếp vào Spam)
if ($sentVia === '') {
    $from = !empty($MAIL_FROM) ? $MAIL_FROM : 'no-reply@' . preg_replace('/^www\./', '', preg_replace('/[^A-Za-z0-9.\-]/', '', $_SERVER['SERVER_NAME'] ?? 'hustdocu.id.vn'));
    $boundaryMail = mail_build($from, 'HUSTDOCU', $email, $subject, $text, $html);
    // mail() tự thêm To và Subject: tách phần header còn lại ra khỏi thư đã dựng
    [$head, $bodyMail] = explode("\r\n\r\n", $boundaryMail, 2);
    $head = implode("\r\n", array_filter(explode("\r\n", $head), function ($h) {
        return stripos($h, 'To:') !== 0 && stripos($h, 'Subject:') !== 0;
    }));
    if (function_exists('mail') && @mail($email, mail_header_text($subject), $bodyMail, $head, '-f' . $from)) {
        $sentVia = 'mail';
    } else {
        $errors[] = 'mail(): thất bại hoặc bị tắt';
    }
}

if ($errors) {
    // Ghi lý do vào log máy chủ (không chứa mã OTP), không trả chi tiết cho người dùng
    error_log('send_otp: ' . implode(' | ', $errors));
}

if ($sentVia === '') {
    @unlink($filePath);
    api_fail(503, 'Hệ thống gửi email đang gặp sự cố, chưa gửi được mã. Vui lòng thử lại sau ít phút hoặc báo quản trị viên.');
}

echo json_encode([
    'success' => true,
    'message' => $sentVia === 'smtp'
        ? 'Mã xác thực đã được gửi tới email của bạn.'
        : 'Mã xác thực đang được gửi, thư có thể đến sau khoảng 1 phút. Nhớ kiểm tra cả mục Spam.',
    'email' => $email,
    'expires_in' => 600,
    'slow' => $sentVia !== 'smtp'
]);
