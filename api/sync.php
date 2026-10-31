<?php
/**
 * API Đồng bộ dữ liệu toàn diện (Universal State Sync) cho HUSTDOCU.
 * Đồng bộ hóa tức thời và tập trung tất cả các chức năng:
 * - Học phần (Courses: mã, tên, tín chỉ, cấu trúc điểm, từ khóa)
 * - Người dùng & Phân quyền (Users: tài khoản, vai trò Quản trị viên, Kiểm duyệt viên, độ uy tín, điểm thưởng)
 * - Lượt tải & Tín chỉ (Credits: cấu hình hạn mức, lịch sử thưởng/trừ, tài khoản bị khóa)
 * - Kiểm duyệt nâng cao (Moderation: cài đặt tự động duyệt, kháng nghị, yêu cầu gỡ bỏ, CTV)
 * - Quảng cáo & Không gian & Hỏi đáp (Commercial & Community: chiến dịch banner, không gian học tập, Q&A)
 * - Tương tác cộng đồng (Comments, Ratings, Reviews học phần, Báo cáo vi phạm, Nhật ký quản trị, Tin nhắn chat)
 */
require_once __DIR__ . '/_security.php';
api_headers(['GET', 'POST', 'OPTIONS']);

const SYSTEM_ADMIN_EMAILS = [
    'khanhhoang23072006@gmail.com',
    'admin@hustdocu.id.vn',
    'admin@lofcreate.online',
    'admin@hust.edu.vn',
    'admin.demo@hust.edu.vn'
];

function sync_data_dir(): string
{
    $dir = __DIR__ . '/data';
    if (!is_dir($dir)) {
        @mkdir($dir, 0755, true);
    }
    if (!file_exists($dir . '/.htaccess')) {
        @file_put_contents($dir . '/.htaccess', "<IfModule mod_authz_core.c>\nRequire all denied\n</IfModule>\n<IfModule !mod_authz_core.c>\nOrder Deny,Allow\nDeny from all\n</IfModule>\n");
    }
    return $dir;
}

function sync_state_file(): string
{
    return sync_data_dir() . '/app_state.json';
}

/**
 * Đọc và ghi trạng thái với khóa file an toàn (flock LOCK_EX)
 */
function sync_state_update(callable $fn): array
{
    $filePath = sync_state_file();
    $fp = @fopen($filePath, 'c+');
    if (!$fp) {
        api_fail(500, 'Máy chủ không thể mở file lưu trữ trạng thái.');
    }
    flock($fp, LOCK_EX);
    $raw = stream_get_contents($fp);
    $state = json_decode($raw ?: '{}', true);
    if (!is_array($state)) {
        $state = [];
    }

    $result = $fn($state);

    ftruncate($fp, 0);
    rewind($fp);
    fwrite($fp, json_encode($result, JSON_UNESCAPED_UNICODE));
    flock($fp, LOCK_UN);
    fclose($fp);

    return $result;
}

function sync_state_read(): array
{
    $filePath = sync_state_file();
    if (!is_file($filePath)) {
        return [];
    }
    $raw = @file_get_contents($filePath);
    $state = json_decode($raw ?: '{}', true);
    return is_array($state) ? $state : [];
}

/**
 * Hợp nhất mảng các đối tượng có ID hoặc mã định danh
 */
function merge_entities_by_key(array $serverList, array $clientList, string $keyField = 'id', ?callable $customMerger = null): array
{
    $map = [];
    foreach ($serverList as $item) {
        if (!is_array($item)) continue;
        $k = strtolower(trim((string)($item[$keyField] ?? '')));
        if ($k !== '') {
            $map[$k] = $item;
        }
    }

    foreach ($clientList as $item) {
        if (!is_array($item)) continue;
        $k = strtolower(trim((string)($item[$keyField] ?? '')));
        if ($k === '') continue;

        if (isset($map[$k])) {
            if ($customMerger) {
                $map[$k] = $customMerger($map[$k], $item);
            } else {
                $map[$k] = array_merge($map[$k], $item);
            }
        } else {
            $map[$k] = $item;
        }
    }

    return array_values($map);
}

/**
 * Hợp nhất danh sách người dùng, bảo toàn quyền Admin và mật khẩu
 */
function merge_users(array $serverUsers, array $clientUsers): array
{
    $map = [];
    foreach ($serverUsers as $u) {
        if (!is_array($u)) continue;
        $em = strtolower(trim((string)($u['email'] ?? '')));
        if ($em !== '') $map[$em] = $u;
    }

    foreach ($clientUsers as $cu) {
        if (!is_array($cu)) continue;
        $em = strtolower(trim((string)($cu['email'] ?? '')));
        if ($em === '') continue;

        if (isset($map[$em])) {
            $su = $map[$em];
            // Merge roles
            $rolesMap = [];
            foreach (($su['roles'] ?? []) as $r) {
                if (!is_array($r) || empty($r['key'])) continue;
                $rk = $r['key'] . ':' . ($r['faculty'] ?? '');
                $rolesMap[$rk] = $r;
            }
            foreach (($cu['roles'] ?? []) as $r) {
                if (!is_array($r) || empty($r['key'])) continue;
                $rk = $r['key'] . ':' . ($r['faculty'] ?? '');
                $rolesMap[$rk] = $r;
            }
            // Bảo toàn quyền Admin nếu có
            if (in_array($em, SYSTEM_ADMIN_EMAILS, true)) {
                $rolesMap['ADMIN:'] = ['key' => 'ADMIN', 'faculty' => null];
                $rolesMap['MODERATOR:'] = ['key' => 'MODERATOR', 'faculty' => null];
            }

            // Mật khẩu & hash
            $passHash = !empty($cu['passwordHash']) ? $cu['passwordHash'] : ($su['passwordHash'] ?? null);

            $mergedUser = array_merge($su, $cu);
            $mergedUser['roles'] = array_values($rolesMap);
            if ($passHash) $mergedUser['passwordHash'] = $passHash;
            $mergedUser['reputation'] = max((int)($su['reputation'] ?? 0), (int)($cu['reputation'] ?? 0));
            $mergedUser['approved'] = max((int)($su['approved'] ?? 0), (int)($cu['approved'] ?? 0));
            $mergedUser['trust'] = max((int)($su['trust'] ?? 1), (int)($cu['trust'] ?? 1));

            $map[$em] = $mergedUser;
        } else {
            if (in_array($em, SYSTEM_ADMIN_EMAILS, true)) {
                $cu['roles'] = $cu['roles'] ?? [];
                if (!is_array($cu['roles'])) $cu['roles'] = [];
                $hasAdmin = false;
                foreach ($cu['roles'] as $r) {
                    if (($r['key'] ?? '') === 'ADMIN') $hasAdmin = true;
                }
                if (!$hasAdmin) {
                    $cu['roles'][] = ['key' => 'ADMIN', 'faculty' => null];
                    $cu['roles'][] = ['key' => 'MODERATOR', 'faculty' => null];
                }
            }
            $map[$em] = $cu;
        }
    }

    return array_values($map);
}

/**
 * Hợp nhất hệ thống Lượt tải (Credits)
 */
function merge_credits(array $serverCr, array $clientCr): array
{
    $base = array_merge($serverCr, $clientCr);
    $settings = array_merge((array)($serverCr['settings'] ?? []), (array)($clientCr['settings'] ?? []));

    // Ledger: hợp nhất các giao dịch theo id
    $ledger = merge_entities_by_key((array)($serverCr['ledger'] ?? []), (array)($clientCr['ledger'] ?? []), 'id');
    usort($ledger, fn($a, $b) => ($b['t'] ?? 0) <=> ($a['t'] ?? 0));

    // Quota, locked, debt
    $quota = array_merge((array)($serverCr['quota'] ?? []), (array)($clientCr['quota'] ?? []));
    $locked = array_merge((array)($serverCr['locked'] ?? []), (array)($clientCr['locked'] ?? []));
    $debt = array_merge((array)($serverCr['debt'] ?? []), (array)($clientCr['debt'] ?? []));

    // Lịch sử tải dl
    $dl = merge_entities_by_key((array)($serverCr['dl'] ?? []), (array)($clientCr['dl'] ?? []), 'id');
    if (count($dl) > 2000) {
        $dl = array_slice($dl, 0, 2000);
    }

    $seq = max((int)($serverCr['seq'] ?? 1), (int)($clientCr['seq'] ?? 1));

    $base['settings'] = $settings;
    $base['ledger'] = $ledger;
    $base['quota'] = $quota;
    $base['locked'] = $locked;
    $base['debt'] = $debt;
    $base['dl'] = $dl;
    $base['devices'] = array_merge((array)($serverCr['devices'] ?? []), (array)($clientCr['devices'] ?? []));
    $base['rate'] = array_merge((array)($serverCr['rate'] ?? []), (array)($clientCr['rate'] ?? []));
    $base['shift'] = $clientCr['shift'] ?? ($serverCr['shift'] ?? 0);
    $base['seq'] = $seq;
    return $base;
}

/**
 * Hợp nhất hệ thống Kiểm duyệt (Mod)
 */
function merge_mod(array $serverMod, array $clientMod): array
{
    $base = array_merge($serverMod, $clientMod);
    $settings = array_merge((array)($serverMod['settings'] ?? []), (array)($clientMod['settings'] ?? []));
    $appeals = merge_entities_by_key((array)($serverMod['appeals'] ?? []), (array)($clientMod['appeals'] ?? []), 'id');
    $takedowns = merge_entities_by_key((array)($serverMod['takedowns'] ?? []), (array)($clientMod['takedowns'] ?? []), 'id');
    $applications = merge_entities_by_key((array)($serverMod['applications'] ?? []), (array)($clientMod['applications'] ?? []), 'id');
    $recs = merge_entities_by_key((array)($serverMod['recs'] ?? []), (array)($clientMod['recs'] ?? []), 'email');
    $autoLog = merge_entities_by_key((array)($serverMod['autoLog'] ?? []), (array)($clientMod['autoLog'] ?? []), 'id');

    $base['settings'] = $settings;
    $base['appeals'] = $appeals;
    $base['takedowns'] = $takedowns;
    $base['applications'] = $applications;
    $base['recs'] = $recs;
    $base['autoLog'] = array_slice($autoLog, 0, 1000);
    return $base;
}

/**
 * Hợp nhất hệ thống Thương mại / Cộng đồng (CM)
 */
function merge_cm(array $serverCm, array $clientCm): array
{
    $base = array_merge($serverCm, $clientCm);
    $ads = merge_entities_by_key((array)($serverCm['ads'] ?? []), (array)($clientCm['ads'] ?? []), 'id');
    $ads = array_values(array_filter($ads, fn($a) => empty($a['deleted'])));
    $spaces = merge_entities_by_key((array)($serverCm['spaces'] ?? []), (array)($clientCm['spaces'] ?? []), 'id');
    $spaces = array_values(array_filter($spaces, fn($s) => empty($s['deleted'])));
    $questions = merge_entities_by_key((array)($serverCm['questions'] ?? []), (array)($clientCm['questions'] ?? []), 'id');
    $events = merge_entities_by_key((array)($serverCm['events'] ?? []), (array)($clientCm['events'] ?? []), 'id');
    $certs = merge_entities_by_key((array)($serverCm['certs'] ?? []), (array)($clientCm['certs'] ?? []), 'id');

    $base['ads'] = $ads;
    $base['spaces'] = $spaces;
    $base['questions'] = $questions;
    $base['events'] = $events;
    $base['certs'] = $certs;
    $base['adSeen'] = array_merge((array)($serverCm['adSeen'] ?? []), (array)($clientCm['adSeen'] ?? []));
    $base['adHidden'] = array_merge((array)($serverCm['adHidden'] ?? []), (array)($clientCm['adHidden'] ?? []));
    return $base;
}

$action = (string)($_GET['action'] ?? 'pull');
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$now = round(microtime(true) * 1000);

// -------------------------------------------------------------
// GET ?action=pull : Lấy trạng thái hiện tại từ máy chủ
// -------------------------------------------------------------
if ($action === 'pull' && $method === 'GET') {
    $state = sync_state_read();
    echo json_encode([
        'success' => true,
        'state' => $state,
        'serverTime' => $now
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// -------------------------------------------------------------
// POST ?action=sync : Đồng bộ 2 chiều tức thời toàn bộ chức năng
// -------------------------------------------------------------
if ($action === 'sync' && $method === 'POST') {
    $rawInput = file_get_contents('php://input');
    $input = json_decode($rawInput, true);
    if (!is_array($input)) {
        api_fail(400, 'Dữ liệu đồng bộ JSON không hợp lệ.');
    }

    $clientState = (array)($input['state'] ?? $input);

    $merged = sync_state_update(function (array $server) use ($clientState, $now) {
        $result = $server;

        // 1. Học phần (Courses)
        if (!empty($clientState['courses']) && is_array($clientState['courses'])) {
            $result['courses'] = merge_entities_by_key(
                (array)($server['courses'] ?? []),
                $clientState['courses'],
                'code'
            );
        }

        // 2. Người dùng & Phân quyền (Users)
        if (!empty($clientState['users']) && is_array($clientState['users'])) {
            $result['users'] = merge_users(
                (array)($server['users'] ?? []),
                $clientState['users']
            );
        }

        // 3. Lượt tải & Tín chỉ (Credits)
        if (!empty($clientState['credits']) && is_array($clientState['credits'])) {
            $result['credits'] = merge_credits(
                (array)($server['credits'] ?? []),
                $clientState['credits']
            );
        }

        // 4. Kiểm duyệt nâng cao (Mod)
        if (!empty($clientState['mod']) && is_array($clientState['mod'])) {
            $result['mod'] = merge_mod(
                (array)($server['mod'] ?? []),
                $clientState['mod']
            );
        }

        // 5. Thương mại / Cộng đồng (CM)
        if (!empty($clientState['cm']) && is_array($clientState['cm'])) {
            $result['cm'] = merge_cm(
                (array)($server['cm'] ?? []),
                $clientState['cm']
            );
        }

        // 6. Bình luận tài liệu (Comments)
        if (isset($clientState['comments']) && is_array($clientState['comments'])) {
            $comments = merge_entities_by_key(
                (array)($server['comments'] ?? []),
                $clientState['comments'],
                'id'
            );
            usort($comments, fn($a, $b) => ($a['t'] ?? 0) <=> ($b['t'] ?? 0));
            $result['comments'] = $comments;
        }

        // 7. Chấm điểm tài liệu (Ratings)
        if (isset($clientState['ratings']) && is_array($clientState['ratings'])) {
            $serverRatings = (array)($server['ratings'] ?? []);
            foreach ($clientState['ratings'] as $docId => $uRatings) {
                if (!is_array($uRatings)) continue;
                if (!isset($serverRatings[$docId])) $serverRatings[$docId] = [];
                foreach ($uRatings as $uEmail => $score) {
                    $serverRatings[$docId][$uEmail] = (int)$score;
                }
            }
            $result['ratings'] = $serverRatings;
        }

        // 8. Đánh giá học phần (Reviews)
        if (isset($clientState['reviews']) && is_array($clientState['reviews'])) {
            $result['reviews'] = merge_entities_by_key(
                (array)($server['reviews'] ?? []),
                $clientState['reviews'],
                'id'
            );
        }

        // 9. Báo cáo vi phạm (Reports)
        if (isset($clientState['reports']) && is_array($clientState['reports'])) {
            $result['reports'] = merge_entities_by_key(
                (array)($server['reports'] ?? []),
                $clientState['reports'],
                'id'
            );
        }

        // 10. Nhật ký quản trị (Audit)
        if (isset($clientState['audit']) && is_array($clientState['audit'])) {
            $auditMap = [];
            foreach ((array)($server['audit'] ?? []) as $a) {
                if (!is_array($a)) continue;
                $k = ($a['t'] ?? '') . '_' . ($a['by'] ?? '') . '_' . ($a['action'] ?? '');
                $auditMap[$k] = $a;
            }
            foreach ($clientState['audit'] as $a) {
                if (!is_array($a)) continue;
                $k = ($a['t'] ?? '') . '_' . ($a['by'] ?? '') . '_' . ($a['action'] ?? '');
                $auditMap[$k] = $a;
            }
            $auditList = array_values($auditMap);
            usort($auditList, fn($a, $b) => ($b['t'] ?? 0) <=> ($a['t'] ?? 0));
            $result['audit'] = array_slice($auditList, 0, 500);
        }

        // 11. Tin nhắn trò chuyện (Messages)
        if (isset($clientState['messages']) && is_array($clientState['messages'])) {
            $messages = merge_entities_by_key(
                (array)($server['messages'] ?? []),
                $clientState['messages'],
                'id'
            );
            usort($messages, fn($a, $b) => ($a['t'] ?? 0) <=> ($b['t'] ?? 0));
            if (count($messages) > 1000) {
                $messages = array_slice($messages, -1000);
            }
            $result['messages'] = $messages;
        }

        // 12. Phòng trò chuyện (Rooms)
        if (isset($clientState['rooms']) && is_array($clientState['rooms'])) {
            $result['rooms'] = merge_entities_by_key(
                (array)($server['rooms'] ?? []),
                $clientState['rooms'],
                'id'
            );
        }

        // 12b. Nhóm trò chuyện (Groups)
        if (isset($clientState['groups']) && is_array($clientState['groups'])) {
            $result['groups'] = merge_entities_by_key(
                (array)($server['groups'] ?? []),
                $clientState['groups'],
                'id'
            );
        }

        // 13. Thông báo (Notifications)
        if (isset($clientState['notifications']) && is_array($clientState['notifications'])) {
            $notis = merge_entities_by_key(
                (array)($server['notifications'] ?? []),
                $clientState['notifications'],
                'id'
            );
            usort($notis, fn($a, $b) => ($b['t'] ?? 0) <=> ($a['t'] ?? 0));
            $result['notifications'] = array_slice($notis, 0, 500);
        }

        // 14. Góc học tập & Phòng học chung (Study)
        if (isset($clientState['study']) && is_array($clientState['study'])) {
            $result['study'] = array_merge((array)($server['study'] ?? []), $clientState['study']);
        }

        // 15. Tài liệu đã lưu (Saved)
        if (isset($clientState['saved']) && is_array($clientState['saved'])) {
            $saved = (array)($server['saved'] ?? []);
            foreach ($clientState['saved'] as $uEmail => $docIds) {
                if (!is_array($docIds)) continue;
                $saved[$uEmail] = array_values(array_unique(array_merge((array)($saved[$uEmail] ?? []), $docIds)));
            }
            $result['saved'] = $saved;
        }

        // 16. Theo dõi học phần (Follows)
        if (isset($clientState['follows']) && is_array($clientState['follows'])) {
            $follows = (array)($server['follows'] ?? []);
            foreach ($clientState['follows'] as $uEmail => $cCodes) {
                if (!is_array($cCodes)) continue;
                $follows[$uEmail] = array_values(array_unique(array_merge((array)($follows[$uEmail] ?? []), $cCodes)));
            }
            $result['follows'] = $follows;
        }

        $result['updatedAt'] = $now;
        return $result;
    });

    echo json_encode([
        'success' => true,
        'state' => $merged,
        'serverTime' => $now
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

api_fail(400, 'Hành động không hợp lệ.');
