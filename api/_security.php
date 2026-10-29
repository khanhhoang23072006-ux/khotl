<?php
// Hàm dùng chung cho các API: header an toàn, chặn gọi từ trang khác, giới hạn tần suất.
// File này chỉ khai báo hàm; gọi trực tiếp không làm gì.
if (basename($_SERVER['SCRIPT_FILENAME'] ?? '') === basename(__FILE__)) {
    http_response_code(404);
    exit;
}

/** Header chung: JSON, không cho nhúng, không đoán kiểu, không cache. Chỉ nhận yêu cầu từ chính trang web. */
function api_headers(array $methods)
{
    header('Content-Type: application/json; charset=UTF-8');
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: DENY');
    header('Referrer-Policy: same-origin');
    header('Cache-Control: no-store');
    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
        // Không bật CORS: trang web và API cùng tên miền nên không cần
        http_response_code(204);
        exit;
    }
    if (!in_array($_SERVER['REQUEST_METHOD'] ?? '', $methods, true)) {
        api_fail(405, 'Phương thức không được hỗ trợ.');
    }
    // Chặn trang khác gọi API bằng trình duyệt của người dùng (CSRF): Origin, nếu có, phải trùng tên miền
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin !== '') {
        $host = $_SERVER['HTTP_HOST'] ?? '';
        $originHost = parse_url($origin, PHP_URL_HOST) . (parse_url($origin, PHP_URL_PORT) ? ':' . parse_url($origin, PHP_URL_PORT) : '');
        if ($host === '' || strcasecmp($originHost, $host) !== 0) {
            api_fail(403, 'Yêu cầu không hợp lệ.');
        }
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
