<?php
// Hàm dùng chung cho các API: header an toàn, chặn gọi từ trang khác, giới hạn tần suất.
// File này chỉ khai báo hàm; gọi trực tiếp không làm gì.
if (basename($_SERVER['SCRIPT_FILENAME'] ?? '') === basename(__FILE__)) {
    http_response_code(404);
    exit;
}

/**
 * Tên miền khác được phép gọi API từ trình duyệt (CORS). Bản trang chạy trên GitHub Pages không chạy được PHP
 * nên gọi sang hosting này. Chỉ liệt kê tên miền của chính dự án, không bao giờ dùng '*'.
 */
const API_ALLOWED_ORIGINS = ['https://khanhhoang23072006-ux.github.io'];

/** Header chung: JSON, không cho nhúng, không đoán kiểu, không cache. Chỉ nhận yêu cầu từ chính trang web. */
function api_headers(array $methods)
{
    header('Content-Type: application/json; charset=UTF-8');
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: DENY');
    header('Referrer-Policy: same-origin');
    header('Cache-Control: no-store');
    header('Vary: Origin');
    // Chặn trang khác gọi API bằng trình duyệt của người dùng (CSRF): Origin, nếu có, phải trùng tên miền
    // hoặc nằm trong API_ALLOWED_ORIGINS
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin !== '') {
        $host = $_SERVER['HTTP_HOST'] ?? '';
        $originHost = parse_url($origin, PHP_URL_HOST) . (parse_url($origin, PHP_URL_PORT) ? ':' . parse_url($origin, PHP_URL_PORT) : '');
        $sameHost = $host !== '' && strcasecmp($originHost, $host) === 0;
        $allowed = in_array(rtrim($origin, '/'), API_ALLOWED_ORIGINS, true);
        if (!$sameHost && !$allowed) {
            api_fail(403, 'Yêu cầu không hợp lệ.');
        }
        if ($allowed) {
            header('Access-Control-Allow-Origin: ' . rtrim($origin, '/'));
            header('Access-Control-Allow-Methods: ' . implode(', ', $methods) . ', OPTIONS');
            header('Access-Control-Allow-Headers: Content-Type, X-Admin-Token');
            header('Access-Control-Max-Age: 600');
        }
    }
    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
    if (!in_array($_SERVER['REQUEST_METHOD'] ?? '', $methods, true)) {
        api_fail(405, 'Phương thức không được hỗ trợ.');
    }
}

function api_fail(int $code, string $message, array $extra = [])
{
    http_response_code($code);
    echo json_encode(['success' => false, 'message' => $message] + $extra);
    exit;
}

/** IP người gọi (hosting chia sẻ: dùng REMOTE_ADDR, không tin header X-Forwarded-For do người dùng tự đặt). */
function client_ip(): string
{
    return $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
}

function api_data_dir(): string
{
    $dir = __DIR__ . '/data/otps';
    if (!is_dir($dir)) {
        @mkdir($dir, 0755, true);
    }
    if (!file_exists($dir . '/.htaccess')) {
        @file_put_contents($dir . '/.htaccess', "Order Deny,Allow\nDeny from all\n");
    }
    return $dir;
}

/**
 * Giới hạn tần suất theo khóa (email, IP…): tối đa $max lần trong $window giây.
 * Trả về số giây phải chờ (0 nếu được phép) và ghi nhận lần gọi khi được phép.
 */
function rate_limit(string $bucket, string $key, int $max, int $window): int
{
    $file = api_data_dir() . '/rl-' . $bucket . '-' . hash('sha256', $key) . '.json';
    $now = time();
    $fp = @fopen($file, 'c+');
    if (!$fp) {
        return 0;
    }
    flock($fp, LOCK_EX);
    $raw = stream_get_contents($fp);
    $hits = array_values(array_filter(json_decode($raw ?: '[]', true) ?: [], function ($t) use ($now, $window) {
        return is_int($t) && $t > $now - $window;
    }));
    $wait = 0;
    if (count($hits) >= $max) {
        $wait = max(1, $hits[0] + $window - $now);
    } else {
        $hits[] = $now;
        ftruncate($fp, 0);
        rewind($fp);
        fwrite($fp, json_encode($hits));
    }
    flock($fp, LOCK_UN);
    fclose($fp);
    // Dọn file giới hạn cũ thỉnh thoảng
    if (mt_rand(1, 200) === 1) {
        foreach (glob(api_data_dir() . '/rl-*.json') ?: [] as $f) {
            if (@filemtime($f) < $now - 86400) {
                @unlink($f);
            }
        }
    }
    return $wait;
}

function wait_text(int $sec): string
{
    return $sec >= 60 ? ceil($sec / 60) . ' phút' : $sec . ' giây';
}

/* ---------- Phiên quản trị lưu trên máy chủ ----------
 * Dữ liệu trang chạy trên trình duyệt nên không tin được vai trò "quản trị" phía trình duyệt.
 * Việc cần quyền thật (đăng extension…) phải có token do verify_otp.php cấp sau khi xác minh OTP hoặc mã quản trị.
 * Máy chủ chỉ lưu bản băm SHA-256 của token. */
const API_ADMIN_EMAILS = [
    'khanhhoang23072006@gmail.com',
    'admin@hustdocu.id.vn',
    'admin@lofcreate.online',
    'admin@hust.edu.vn',
    'admin.demo@hust.edu.vn',
];
const ADMIN_SESSION_TTL = 7 * 86400;

function is_admin_email(string $email): bool
{
    return in_array(strtolower(trim($email)), API_ADMIN_EMAILS, true);
}

function admin_session_dir(): string
{
    $dir = __DIR__ . '/data/sessions';
    if (!is_dir($dir)) {
        @mkdir($dir, 0755, true);
    }
    if (!file_exists($dir . '/.htaccess')) {
        @file_put_contents($dir . '/.htaccess', "Order Deny,Allow\nDeny from all\n");
    }
    return $dir;
}

/** Cấp token phiên quản trị (trả về token gốc để gửi cho trình duyệt). */
function admin_session_issue(string $email): string
{
    $token = bin2hex(random_bytes(32));
    $dir = admin_session_dir();
    @file_put_contents($dir . '/' . hash('sha256', $token) . '.json', json_encode([
        'email' => strtolower(trim($email)),
        'expires_at' => time() + ADMIN_SESSION_TTL,
    ]), LOCK_EX);
    // Dọn phiên hết hạn thỉnh thoảng
    if (mt_rand(1, 50) === 1) {
        foreach (glob($dir . '/*.json') ?: [] as $f) {
            $d = json_decode((string)@file_get_contents($f), true);
            if (!$d || ($d['expires_at'] ?? 0) < time()) {
                @unlink($f);
            }
        }
    }
    return $token;
}

/** Email quản trị của token, hoặc '' nếu token sai/hết hạn. */
function admin_session_email(string $token): string
{
    if (!preg_match('/^[a-f0-9]{64}$/', $token)) {
        return '';
    }
    $file = admin_session_dir() . '/' . hash('sha256', $token) . '.json';
    $d = is_file($file) ? json_decode((string)@file_get_contents($file), true) : null;
    if (!$d || ($d['expires_at'] ?? 0) < time() || !is_admin_email((string)($d['email'] ?? ''))) {
        @unlink($file);
        return '';
    }
    return (string)$d['email'];
}

function admin_session_revoke(string $token): void
{
    if (preg_match('/^[a-f0-9]{64}$/', $token)) {
        @unlink(admin_session_dir() . '/' . hash('sha256', $token) . '.json');
    }
}

/** Dừng với lỗi 401 nếu yêu cầu không kèm token quản trị hợp lệ (header X-Admin-Token). */
function require_admin(): string
{
    $email = admin_session_email(trim((string)($_SERVER['HTTP_X_ADMIN_TOKEN'] ?? '')));
    if ($email === '') {
        api_fail(401, 'Cần xác minh quyền quản trị (mã OTP hoặc mã quản trị) trước khi thực hiện.', ['need_admin' => true]);
    }
    return $email;
}
