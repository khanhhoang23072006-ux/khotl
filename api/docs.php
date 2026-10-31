<?php
/**
 * API đồng bộ và lưu trữ tài liệu tập trung cho HUSTDOCU.
 *
 *   GET  ?action=list                  Lấy danh sách tất cả tài liệu mới nhất
 *   GET  ?action=get&id=…              Lấy chi tiết một tài liệu theo ID hoặc slug
 *   GET  ?action=file&id=…             Xem file gốc (PDF, ảnh...)
 *   GET  ?action=download&id=…         Tải file về máy (+ tăng lượt tải)
 *   POST ?action=save                  Lưu / cập nhật thông tin tài liệu
 *   POST ?action=bulk_status           Cập nhật trạng thái duyệt hàng loạt (duyệt, từ chối, yêu cầu sửa, gỡ)
 *   POST ?action=sync_all              Đồng bộ 2 chiều toàn bộ tài liệu giữa máy khách và máy chủ
 *   POST ?action=upload_file           Tải file đính kèm và lưu metadata tài liệu
 *   POST ?action=delete                Xoá tài liệu
 *   GET  ?action=courses_list          Lấy danh sách học phần dùng chung
 *   POST ?action=courses_save          Lưu danh sách học phần cập nhật từ Admin
 */
require_once __DIR__ . '/_security.php';
api_headers(['GET', 'POST', 'OPTIONS']);

const DOCS_MAX_FILE_BYTES = 50 * 1024 * 1024; // 50 MB
const DOCS_MAX_ZIP_BYTES = 100 * 1024 * 1024; // 100 MB
const ALLOWED_DOC_EXTS = ['pdf', 'docx', 'pptx', 'xlsx', 'jpg', 'jpeg', 'png', 'webp', 'zip'];

function docs_dir(): string
{
    $dir = __DIR__ . '/data/docs';
    if (!is_dir($dir)) {
        @mkdir($dir, 0755, true);
    }
    if (!file_exists($dir . '/.htaccess')) {
        @file_put_contents($dir . '/.htaccess', "<IfModule mod_authz_core.c>\nRequire all denied\n</IfModule>\n<IfModule !mod_authz_core.c>\nOrder Deny,Allow\nDeny from all\n</IfModule>\n");
    }
    return $dir;
}

function docs_files_dir(): string
{
    $dir = docs_dir() . '/files';
    if (!is_dir($dir)) {
        @mkdir($dir, 0755, true);
    }
    if (!file_exists($dir . '/.htaccess')) {
        @file_put_contents($dir . '/.htaccess', "<IfModule mod_authz_core.c>\nRequire all denied\n</IfModule>\n<IfModule !mod_authz_core.c>\nOrder Deny,Allow\nDeny from all\n</IfModule>\n");
    }
    return $dir;
}

/**
 * Đọc và ghi danh sách tài liệu với khoá file (LOCK_EX) để chống xung đột ghi đè.
 */
function docs_update(callable $fn)
{
    $filePath = docs_dir() . '/documents.json';
    $fp = @fopen($filePath, 'c+');
    if (!$fp) {
        api_fail(500, 'Máy chủ không mở được file dữ liệu tài liệu.');
    }
    flock($fp, LOCK_EX);
    $raw = stream_get_contents($fp);
    $docs = json_decode($raw ?: '[]', true);
    if (!is_array($docs)) {
        $docs = [];
    }

    $result = $fn($docs);

    ftruncate($fp, 0);
    rewind($fp);
    fwrite($fp, json_encode(array_values($docs), JSON_UNESCAPED_UNICODE));
    flock($fp, LOCK_UN);
    fclose($fp);

    return $result;
}

function docs_all(): array
{
    $filePath = docs_dir() . '/documents.json';
    if (!is_file($filePath)) {
        return [];
    }
    $raw = @file_get_contents($filePath);
    $docs = json_decode($raw ?: '[]', true);
    return is_array($docs) ? $docs : [];
}

function doc_find(string $idOrSlug): ?array
{
    $target = strtolower(trim($idOrSlug));
    if ($target === '') return null;
    $docs = docs_all();
    foreach ($docs as $d) {
        if (strtolower((string)($d['id'] ?? '')) === $target || strtolower((string)($d['slug'] ?? '')) === $target) {
            return $d;
        }
    }
    return null;
}

function safe_doc_id(string $id): string
{
    $clean = preg_replace('/[^a-zA-Z0-9_\-]/', '', $id);
    return substr($clean, 0, 80);
}

$action = (string)($_GET['action'] ?? 'list');
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

// -------------------------------------------------------------
// GET ?action=list : Lấy danh sách tài liệu
// -------------------------------------------------------------
if ($action === 'list' && $method === 'GET') {
    $docs = docs_all();
    echo json_encode([
        'success' => true,
        'count' => count($docs),
        'docs' => $docs,
        'serverTime' => round(microtime(true) * 1000)
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// -------------------------------------------------------------
// GET ?action=get&id=… : Chi tiết 1 tài liệu
// -------------------------------------------------------------
if ($action === 'get' && $method === 'GET') {
    $id = (string)($_GET['id'] ?? $_GET['slug'] ?? '');
    $doc = doc_find($id);
    if (!$doc) {
        api_fail(404, 'Không tìm thấy tài liệu.');
    }
    echo json_encode(['success' => true, 'doc' => $doc], JSON_UNESCAPED_UNICODE);
    exit;
}

// -------------------------------------------------------------
// GET ?action=file&id=… : Xem file trực tiếp
// -------------------------------------------------------------
if ($action === 'file' && $method === 'GET') {
    $id = safe_doc_id((string)($_GET['id'] ?? ''));
    if ($id === '') api_fail(400, 'Thiếu ID tài liệu.');

    $filesDir = docs_files_dir();
    $matched = glob($filesDir . '/' . $id . '.*');
    if (!$matched || !is_file($matched[0])) {
        api_fail(404, 'Tệp tài liệu không tồn tại trên máy chủ.');
    }

    $filePath = $matched[0];
    $ext = strtolower(pathinfo($filePath, PATHINFO_EXTENSION));
    $mime = [
        'pdf'  => 'application/pdf',
        'png'  => 'image/png',
        'jpg'  => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'webp' => 'image/webp',
        'docx' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'pptx' => 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'xlsx' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'zip'  => 'application/zip'
    ][$ext] ?? 'application/octet-stream';

    header('Content-Type: ' . $mime);
    header('Content-Length: ' . filesize($filePath));
    header('Content-Disposition: inline; filename="' . basename($filePath) . '"');
    header('Cache-Control: public, max-age=86400');
    readfile($filePath);
    exit;
}

// -------------------------------------------------------------
// GET ?action=download&id=… : Tải file đính kèm
// -------------------------------------------------------------
if ($action === 'download' && $method === 'GET') {
    $id = safe_doc_id((string)($_GET['id'] ?? ''));
    if ($id === '') api_fail(400, 'Thiếu ID tài liệu.');

    // Tăng lượt tải
    $doc = docs_update(function (array &$docs) use ($id) {
        foreach ($docs as &$d) {
            if ($d['id'] === $id) {
                $d['downloads'] = ($d['downloads'] ?? 0) + 1;
                $d['updatedAt'] = round(microtime(true) * 1000);
                return $d;
            }
        }
        return null;
    });

    $filesDir = docs_files_dir();
    $matched = glob($filesDir . '/' . $id . '.*');
    if (!$matched || !is_file($matched[0])) {
        api_fail(404, 'Tệp tài liệu không tồn tại trên máy chủ.');
    }

    $filePath = $matched[0];
    $downloadName = $doc && !empty($doc['fileName']) ? $doc['fileName'] : basename($filePath);
    $downloadName = preg_replace('/[^\w.\-\s]/u', '_', $downloadName);

    header('Content-Type: application/octet-stream');
    header('Content-Length: ' . filesize($filePath));
    header('Content-Disposition: attachment; filename="' . rawurlencode($downloadName) . '"');
    readfile($filePath);
    exit;
}

// =================== CÁC THAO TÁC POST ===================

$input = [];
if ($method === 'POST') {
    $rawBody = file_get_contents('php://input');
    $input = json_decode($rawBody ?: '[]', true) ?: [];
}

// -------------------------------------------------------------
// POST ?action=upload_file : Tải file và lưu tài liệu
// -------------------------------------------------------------
if ($action === 'upload_file' && $method === 'POST') {
    if (empty($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
        api_fail(400, 'Tải file lên không thành công hoặc file rỗng.');
    }

    $uploaded = $_FILES['file'];
    $origName = $uploaded['name'];
    $ext = strtolower(pathinfo($origName, PATHINFO_EXTENSION));

    if (!in_array($ext, ALLOWED_DOC_EXTS, true)) {
        api_fail(400, 'Định dạng .' . $ext . ' không được hỗ trợ.');
    }

    $maxBytes = ($ext === 'zip') ? DOCS_MAX_ZIP_BYTES : DOCS_MAX_FILE_BYTES;
    if ($uploaded['size'] > $maxBytes) {
        api_fail(400, 'Dung lượng file vượt quá giới hạn (' . round($maxBytes / 1024 / 1024) . ' MB).');
    }

    // Metadata truyền qua form data
    $rawMeta = $_POST['doc'] ?? '{}';
    $docData = is_string($rawMeta) ? json_decode($rawMeta, true) : (is_array($rawMeta) ? $rawMeta : []);
    if (!is_array($docData)) $docData = [];

    $id = safe_doc_id($docData['id'] ?? ('u' . bin2hex(random_bytes(8))));
    $docData['id'] = $id;
    $docData['fileName'] = $origName;
    $docData['sizeKb'] = round($uploaded['size'] / 1024, 2);
    $docData['uploaded'] = true;
    $docData['updatedAt'] = round(microtime(true) * 1000);
    if (empty($docData['createdAt'])) {
        $docData['createdAt'] = round(microtime(true) * 1000);
    }

    // Lưu file vào thư mục bảo vệ
    $dest = docs_files_dir() . '/' . $id . '.' . $ext;
    if (!move_uploaded_file($uploaded['tmp_name'], $dest)) {
        api_fail(500, 'Không thể lưu file trên máy chủ.');
    }

    // Cập nhật hoặc thêm mới vào documents.json
    $savedDoc = docs_update(function (array &$docs) use ($id, $docData) {
        $found = false;
        foreach ($docs as &$item) {
            if ($item['id'] === $id) {
                $item = array_merge($item, $docData);
                $found = true;
                return $item;
            }
        }
        if (!$found) {
            $docs[] = $docData;
            return $docData;
        }
        return null;
    });

    echo json_encode(['success' => true, 'doc' => $savedDoc ?: $docData], JSON_UNESCAPED_UNICODE);
    exit;
}

// -------------------------------------------------------------
// POST ?action=save : Lưu / Chỉnh sửa thông tin tài liệu
// -------------------------------------------------------------
if ($action === 'save' && $method === 'POST') {
    $docData = $input['doc'] ?? null;
    if (!is_array($docData) || empty($docData['id'])) {
        api_fail(400, 'Dữ liệu tài liệu không hợp lệ (thiếu ID).');
    }

    $id = safe_doc_id($docData['id']);
    $docData['id'] = $id;
    $docData['updatedAt'] = round(microtime(true) * 1000);

    $saved = docs_update(function (array &$docs) use ($id, $docData) {
        foreach ($docs as &$item) {
            if ($item['id'] === $id) {
                $item = array_merge($item, $docData);
                return $item;
            }
        }
        // Nếu chưa có, thêm mới
        $docs[] = $docData;
        return $docData;
    });

    echo json_encode(['success' => true, 'doc' => $saved], JSON_UNESCAPED_UNICODE);
    exit;
}

// -------------------------------------------------------------
// POST ?action=bulk_status : Cập nhật trạng thái duyệt hàng loạt
// -------------------------------------------------------------
if ($action === 'bulk_status' && $method === 'POST') {
    $ids = array_map('safe_doc_id', (array)($input['ids'] ?? []));
    $decision = (string)($input['decision'] ?? '');
    $reason = (string)($input['reason'] ?? '');
    $note = (string)($input['note'] ?? '');
    $by = (string)($input['by'] ?? 'admin');
    $incomingDocs = (array)($input['docs'] ?? []);

    if (empty($ids) || $decision === '') {
        api_fail(400, 'Thiếu danh sách ID hoặc quyết định kiểm duyệt.');
    }

    $statusMap = [
        'APPROVE'          => 'APPROVED',
        'REJECT'           => 'REJECTED',
        'REQUEST_CHANGES'  => 'CHANGES_REQUESTED',
        'REMOVE'           => 'REMOVED'
    ];
    $newStatus = $statusMap[$decision] ?? $decision;

    $updatedCount = docs_update(function (array &$docs) use ($ids, $newStatus, $decision, $reason, $note, $by, $incomingDocs) {
        $count = 0;
        $now = round(microtime(true) * 1000);
        $existingMap = [];

        foreach ($docs as $idx => &$d) {
            $existingMap[$d['id']] = $idx;
            if (in_array($d['id'], $ids, true)) {
                $d['status'] = $newStatus;
                $d['reviewNote'] = ($newStatus === 'APPROVED') ? null : ($reason ?: $d['reviewNote'] ?? null);
                if ($newStatus === 'APPROVED' && empty($d['publishedAt'])) {
                    $d['publishedAt'] = $now;
                }
                $d['updatedAt'] = $now;
                if (!isset($d['logs']) || !is_array($d['logs'])) {
                    $d['logs'] = [];
                }
                array_unshift($d['logs'], [
                    't' => $now,
                    'a' => $decision,
                    'by' => $by,
                    'reason' => $reason ?: null,
                    'note' => $note ?: null
                ]);
                $count++;
            }
        }
        unset($d);

        // Nếu tài liệu được duyệt/thao tác chưa có trên máy chủ, chèn trực tiếp vào máy chủ!
        foreach ($incomingDocs as $item) {
            if (is_array($item) && !empty($item['id'])) {
                $itemId = safe_doc_id($item['id']);
                if (!isset($existingMap[$itemId])) {
                    $item['id'] = $itemId;
                    $item['status'] = $newStatus;
                    $item['updatedAt'] = $now;
                    if ($newStatus === 'APPROVED' && empty($item['publishedAt'])) {
                        $item['publishedAt'] = $now;
                    }
                    $docs[] = $item;
                    $existingMap[$itemId] = count($docs) - 1;
                    $count++;
                }
            }
        }

        return $count;
    });

    echo json_encode(['success' => true, 'updated' => $updatedCount], JSON_UNESCAPED_UNICODE);
    exit;
}

// -------------------------------------------------------------
// POST ?action=sync_all : Đồng bộ 2 chiều toàn bộ tài liệu
// -------------------------------------------------------------
if ($action === 'sync_all' && $method === 'POST') {
    $clientDocs = (array)($input['docs'] ?? []);
    $now = round(microtime(true) * 1000);

    $merged = docs_update(function (array &$docs) use ($clientDocs, $now) {
        $serverMap = [];
        foreach ($docs as $i => $d) {
            $serverMap[$d['id']] = $i;
        }

        foreach ($clientDocs as $cd) {
            if (!is_array($cd) || empty($cd['id'])) continue;
            $id = safe_doc_id($cd['id']);
            $cd['id'] = $id;

            if (isset($serverMap[$id])) {
                $idx = $serverMap[$id];
                $serverDoc = $docs[$idx];
                // Lấy bản mới hơn theo updatedAt
                $serverUp = $serverDoc['updatedAt'] ?? 0;
                $clientUp = $cd['updatedAt'] ?? 0;
                if ($clientUp > $serverUp) {
                    $docs[$idx] = array_merge($serverDoc, $cd);
                }
            } else {
                // Thêm tài liệu mới từ client lên server
                if (empty($cd['updatedAt'])) $cd['updatedAt'] = $now;
                $docs[] = $cd;
                $serverMap[$id] = count($docs) - 1;
            }
        }

        return $docs;
    });

    echo json_encode(['success' => true, 'docs' => $merged, 'serverTime' => $now], JSON_UNESCAPED_UNICODE);
    exit;
}

// -------------------------------------------------------------
// POST ?action=delete : Xoá tài liệu khỏi hệ thống
// -------------------------------------------------------------
if ($action === 'delete' && $method === 'POST') {
    $id = safe_doc_id((string)($input['id'] ?? ''));
    if ($id === '') api_fail(400, 'Thiếu ID tài liệu cần xoá.');

    $removed = docs_update(function (array &$docs) use ($id) {
        $idx = -1;
        foreach ($docs as $i => $d) {
            if ($d['id'] === $id) {
                $idx = $i;
                break;
            }
        }
        if ($idx >= 0) {
            array_splice($docs, $idx, 1);
            return true;
        }
        return false;
    });

    // Xoá file đính kèm nếu có
    $filesDir = docs_files_dir();
    foreach (glob($filesDir . '/' . $id . '.*') ?: [] as $f) {
        @unlink($f);
    }

    echo json_encode(['success' => true, 'deleted' => $removed], JSON_UNESCAPED_UNICODE);
    exit;
}

api_fail(400, 'Hành động không hợp lệ.');
