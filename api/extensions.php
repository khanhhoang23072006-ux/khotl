<?php
/**
 * Kho extension trình duyệt của HUSTDOCU.
 *   GET  ?action=list                 danh sách (công khai)
 *   GET  ?action=download&id=…        tải file .zip (công khai)
 *   POST ?action=check                kiểm tra token quản trị còn hiệu lực
 *   POST ?action=upload  (multipart)  đăng extension mới: file, name, description, guide        [quản trị]
 *   POST ?action=delete  (JSON {id})  xoá extension                                              [quản trị]
 *   POST ?action=logout               huỷ token quản trị
 * Quyền quản trị: header X-Admin-Token do verify_otp.php cấp (xem api/_security.php).
 * File lưu ở api/data/extensions (đã chặn truy cập trực tiếp bằng .htaccess), chỉ tải qua file này.
 */
require_once __DIR__ . '/_security.php';
api_headers(['GET', 'POST']);

const EXT_MAX_BYTES = 25 * 1024 * 1024; // 25 MB
const EXT_MAX_ITEMS = 200;

$action = (string)($_GET['action'] ?? 'list');

function ext_dir(): string
{
    $dir = __DIR__ . '/data/extensions';
    if (!is_dir($dir)) {
        @mkdir($dir, 0755, true);
    }
    if (!file_exists($dir . '/.htaccess')) {
        @file_put_contents($dir . '/.htaccess', "Order Deny,Allow\nDeny from all\n");
    }
    return $dir;
}

/** Đọc rồi ghi danh sách trong cùng một khoá file để hai yêu cầu cùng lúc không ghi đè nhau. */
function ext_update(callable $fn)
{
    $fp = fopen(ext_dir() . '/index.json', 'c+');
    if (!$fp) {
        api_fail(500, 'Máy chủ không ghi được dữ liệu extension.');
    }
    flock($fp, LOCK_EX);
    $items = json_decode(stream_get_contents($fp) ?: '[]', true) ?: [];
    $result = $fn($items);
    ftruncate($fp, 0);
    rewind($fp);
    fwrite($fp, json_encode(array_values($items), JSON_UNESCAPED_UNICODE));
    flock($fp, LOCK_UN);
    fclose($fp);
    return $result;
}

function ext_items(): array
{
    $f = ext_dir() . '/index.json';
    return is_file($f) ? (json_decode((string)file_get_contents($f), true) ?: []) : [];
}

function ext_public(array $it): array
{
    unset($it['sha256'], $it['by']);
    return $it;
}

function clean_text(string $s, int $max): string
{
    $s = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $s) ?? '';
    return mb_substr(trim($s), 0, $max);
}

/** Đọc manifest.json ở gốc file zip hoặc trong một thư mục con cấp một. */
function read_manifest(string $path): ?array
{
    if (!class_exists('ZipArchive')) {
        return null; // hosting không có ZipArchive: bỏ qua bước đọc manifest
    }
    $zip = new ZipArchive();
    if ($zip->open($path) !== true) {
        api_fail(400, 'File .zip bị hỏng hoặc không mở được.');
    }
    if ($zip->numFiles > 5000) {
        $zip->close();
        api_fail(400, 'File .zip có quá nhiều tệp.');
    }
    $found = null;
    for ($i = 0; $i < $zip->numFiles; $i++) {
        $n = (string)$zip->getNameIndex($i);
        if (preg_match('#^([^/]+/)?manifest\.json$#', $n) && ($found === null || strlen($n) < strlen($found))) {
            $found = $n;
        }
    }
    if ($found === null) {
        $zip->close();
        api_fail(400, 'Không thấy manifest.json trong file .zip. Hãy nén thư mục chứa manifest.json của extension.');
    }
    $raw = $zip->getFromName($found, 512 * 1024);
    $zip->close();
    $raw = preg_replace('/^\xEF\xBB\xBF/', '', (string)$raw);
    $m = json_decode($raw, true);
    if (!is_array($m) || empty($m['manifest_version'])) {
        api_fail(400, 'manifest.json không hợp lệ (thiếu manifest_version).');
    }
    return [
        'name' => is_string($m['name'] ?? null) && strpos($m['name'], '__MSG_') !== 0 ? $m['name'] : '',
        'version' => is_string($m['version'] ?? null) ? $m['version'] : '',
        'description' => is_string($m['description'] ?? null) && strpos($m['description'], '__MSG_') !== 0 ? $m['description'] : '',
        'manifest_version' => (int)$m['manifest_version'],
        'permissions' => array_values(array_filter(array_merge(
            is_array($m['permissions'] ?? null) ? $m['permissions'] : [],
            is_array($m['host_permissions'] ?? null) ? $m['host_permissions'] : []
        ), 'is_string')),
    ];
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($action === 'list' && $method === 'GET') {
    echo json_encode(['success' => true, 'items' => array_map('ext_public', ext_items())], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($action === 'download' && $method === 'GET') {
    $wait = rate_limit('ext-dl', client_ip(), 120, 3600);
    if ($wait > 0) {
        api_fail(429, 'Bạn tải quá nhiều lần. Vui lòng thử lại sau ' . wait_text($wait) . '.');
    }
    $id = (string)($_GET['id'] ?? '');
    $item = null;
    if (preg_match('/^[a-f0-9]{16}$/', $id)) {
        $item = ext_update(function (array &$items) use ($id) {
            foreach ($items as &$it) {
                if ($it['id'] === $id) {
                    $it['downloads'] = ($it['downloads'] ?? 0) + 1;
                    return $it;
                }
            }
            return null;
        });
    }
    $file = $item ? ext_dir() . '/' . $id . '.zip' : '';
    if (!$item || !is_file($file)) {
        api_fail(404, 'Không tìm thấy extension này.');
    }
    $fname = preg_replace('/[^A-Za-z0-9._-]+/', '-', (string)$item['file_name']) ?: 'extension.zip';
    header('Content-Type: application/zip');
    header('Content-Disposition: attachment; filename="' . $fname . '"');
    header('Content-Length: ' . filesize($file));
    readfile($file);
    exit;
}

if ($method !== 'POST') {
    api_fail(405, 'Phương thức không được hỗ trợ.');
}

if ($action === 'check') {
    $email = admin_session_email(trim((string)($_SERVER['HTTP_X_ADMIN_TOKEN'] ?? '')));
    echo json_encode(['success' => $email !== '', 'email' => $email]);
    exit;
}

if ($action === 'logout') {
    admin_session_revoke(trim((string)($_SERVER['HTTP_X_ADMIN_TOKEN'] ?? '')));
    echo json_encode(['success' => true]);
    exit;
}

$admin = require_admin();

if ($action === 'upload') {
    $wait = rate_limit('ext-up', $admin, 30, 3600);
    if ($wait > 0) {
        api_fail(429, 'Đăng quá nhiều lần. Vui lòng thử lại sau ' . wait_text($wait) . '.');
    }
    $f = $_FILES['file'] ?? null;
    if (!$f || !is_array($f) || is_array($f['error'])) {
        // Không có $_FILES thường do file vượt post_max_size của hosting
        api_fail(400, 'Chưa nhận được file. Nếu file lớn, có thể hosting giới hạn dung lượng tải lên (post_max_size).');
    }
    if ($f['error'] === UPLOAD_ERR_INI_SIZE || $f['error'] === UPLOAD_ERR_FORM_SIZE) {
        api_fail(413, 'File vượt giới hạn tải lên của hosting (upload_max_filesize = ' . ini_get('upload_max_filesize') . ').');
    }
    if ($f['error'] !== UPLOAD_ERR_OK || !is_uploaded_file($f['tmp_name'])) {
        api_fail(400, 'Tải file lên không thành công (mã lỗi ' . (int)$f['error'] . ').');
    }
    if ($f['size'] <= 0 || $f['size'] > EXT_MAX_BYTES) {
        api_fail(413, 'File phải nhỏ hơn 25 MB.');
    }
    $head = (string)file_get_contents($f['tmp_name'], false, null, 0, 4);
    if ($head !== "PK\x03\x04" || !preg_match('/\.zip$/i', (string)$f['name'])) {
        api_fail(400, 'Chỉ nhận file .zip (nén thư mục extension có manifest.json).');
    }
    $manifest = read_manifest($f['tmp_name']);
    $name = clean_text((string)($_POST['name'] ?? ''), 80) ?: clean_text((string)($manifest['name'] ?? ''), 80);
    $desc = clean_text((string)($_POST['description'] ?? ''), 1000) ?: clean_text((string)($manifest['description'] ?? ''), 1000);
    $guide = clean_text((string)($_POST['guide'] ?? ''), 3000);
    $version = clean_text((string)($_POST['version'] ?? ''), 30) ?: clean_text((string)($manifest['version'] ?? ''), 30);
    if (mb_strlen($name) < 2) {
        api_fail(400, 'Nhập tên extension (tối thiểu 2 ký tự).');
    }
    $sha = hash_file('sha256', $f['tmp_name']);
    $id = bin2hex(random_bytes(8));
    $dest = ext_dir() . '/' . $id . '.zip';
    $item = ext_update(function (array &$items) use ($sha, $id, $name, $desc, $guide, $version, $manifest, $f, $admin, $dest) {
        foreach ($items as $it) {
            if (($it['sha256'] ?? '') === $sha) {
                api_fail(409, 'File này đã được đăng: "' . $it['name'] . '".');
            }
        }
        if (count($items) >= EXT_MAX_ITEMS) {
            api_fail(400, 'Kho đã đủ ' . EXT_MAX_ITEMS . ' extension. Xoá bớt bản cũ trước khi đăng.');
        }
        if (!move_uploaded_file($f['tmp_name'], $dest)) {
            api_fail(500, 'Máy chủ không lưu được file.');
        }
        $base = preg_replace('/[^A-Za-z0-9._-]+/', '-', pathinfo((string)$f['name'], PATHINFO_FILENAME)) ?: 'extension';
        $it = [
            'id' => $id,
            'name' => $name,
            'version' => $version,
            'description' => $desc,
            'guide' => $guide,
            'file_name' => substr($base, 0, 60) . '.zip',
            'size' => (int)$f['size'],
            'manifest_version' => $manifest['manifest_version'] ?? null,
            'permissions' => array_slice($manifest['permissions'] ?? [], 0, 30),
            'downloads' => 0,
            'created_at' => time(),
            'sha256' => $sha,
            'by' => $admin,
        ];
        array_unshift($items, $it);
        return $it;
    });
    echo json_encode(['success' => true, 'item' => ext_public($item)], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($action === 'delete') {
    $input = json_decode((string)file_get_contents('php://input'), true) ?: [];
    $id = (string)($input['id'] ?? '');
    if (!preg_match('/^[a-f0-9]{16}$/', $id)) {
        api_fail(400, 'Mã extension không hợp lệ.');
    }
    $ok = ext_update(function (array &$items) use ($id) {
        $before = count($items);
        $items = array_values(array_filter($items, function ($it) use ($id) { return $it['id'] !== $id; }));
        return count($items) < $before;
    });
    @unlink(ext_dir() . '/' . $id . '.zip');
    if (!$ok) {
        api_fail(404, 'Không tìm thấy extension này.');
    }
    echo json_encode(['success' => true]);
    exit;
}

api_fail(400, 'Thao tác không hợp lệ.');
