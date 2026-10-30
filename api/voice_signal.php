<?php
// Máy chủ tín hiệu (signaling) cho voice chat phòng học: danh sách người trong phòng và chuyển offer/answer/ICE
// giữa các trình duyệt. Âm thanh đi thẳng giữa các máy (WebRTC), không qua máy chủ này.
require_once __DIR__ . '/_security.php';
api_headers(['GET', 'POST']);

$dbDir = __DIR__ . '/data';
api_data_dir();
if (!file_exists($dbDir . '/.htaccess')) {
    @file_put_contents($dbDir . '/.htaccess', "<IfModule mod_authz_core.c>\nRequire all denied\n</IfModule>\n<IfModule !mod_authz_core.c>\nOrder Deny,Allow\nDeny from all\n</IfModule>\n");
}

function vs_id($v)
{
    $v = trim((string)$v);
    return preg_match('/^[A-Za-z0-9:_.\-]{1,80}$/', $v) ? $v : '';
}
function vs_text($v, $max)
{
    $v = trim(preg_replace('/[\x00-\x1F\x7F]/u', '', (string)$v) ?? '');
    return function_exists('mb_substr') ? mb_substr($v, 0, $max) : substr($v, 0, $max);
}
function vs_out(array $data)
{
    echo json_encode($data);
    exit;
}

$VS_TYPES = ['state', 'leave', 'offer', 'answer', 'ice', 'reconnect'];
// Người không gửi tín hiệu quá chừng này giây coi như đã rời phòng (tab nền có thể bị trình duyệt làm chậm)
$PEER_TTL = 40;
$SIGNAL_TTL = 120;
$MAX_PEERS = 12;

$action = $_GET['action'] ?? '';
$isPost = ($_SERVER['REQUEST_METHOD'] ?? '') === 'POST';
$input = [];
if ($isPost) {
    $input = json_decode(file_get_contents('php://input', false, null, 0, 65536), true) ?: [];
}

// Giới hạn tần suất theo từng người trong phòng (peerId) chứ không chỉ theo IP: cả lớp dùng chung Wi-Fi trường
// có cùng một IP, giới hạn theo IP sẽ chặn cả phòng. Giới hạn IP chỉ để chặn lạm dụng quy mô lớn.
$peerKey = vs_id($input['peerId'] ?? $input['fromPeer'] ?? $_GET['peerId'] ?? '') ?: 'none';
foreach ([['voice-peer', client_ip() . '|' . $peerKey, 400, 60], ['voice-ip', client_ip(), 12000, 60]] as $r) {
    $wait = rate_limit($r[0], $r[1], $r[2], $r[3]);
    if ($wait > 0) {
        api_fail(429, 'Quá nhiều yêu cầu.', ['retry_after' => $wait]);
    }
}

// Cấu hình ICE (STUN/TURN) cho trình duyệt: TURN giúp người dùng mạng 4G, mạng trường nối được với nhau
if ($action === 'config') {
    @include_once __DIR__ . '/config.php';
    $servers = [['urls' => ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478']]];
    $turnUrls = array_values(array_filter(array_map('trim', is_array($TURN_URLS ?? null) ? $TURN_URLS : explode(',', (string)($TURN_URLS ?? '')))));
    if ($turnUrls) {
        if (!empty($TURN_SECRET)) {
            // coturn use-auth-secret: tên = hạn dùng, mật khẩu = HMAC-SHA1 (hết hạn sau 6 giờ)
            $user = (time() + 6 * 3600) . ':' . ($peerKey !== 'none' ? $peerKey : 'hustdocu');
            $servers[] = ['urls' => $turnUrls, 'username' => $user, 'credential' => base64_encode(hash_hmac('sha1', $user, $TURN_SECRET, true))];
        } elseif (!empty($TURN_USERNAME)) {
            $servers[] = ['urls' => $turnUrls, 'username' => (string)$TURN_USERNAME, 'credential' => (string)($TURN_CREDENTIAL ?? '')];
        }
    }
    vs_out(['ok' => true, 'iceServers' => $servers, 'turn' => count($servers) > 1]);
}

$dbPath = $dbDir . '/voice_signal.db';
try {
    if (!in_array('sqlite', PDO::getAvailableDrivers(), true)) {
        throw new RuntimeException('Hosting chưa bật PHP extension pdo_sqlite');
    }
    $db = new PDO("sqlite:$dbPath");
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $db->setAttribute(PDO::ATTR_TIMEOUT, 5);
    $db->exec("PRAGMA journal_mode = WAL");
    $db->exec("PRAGMA synchronous = NORMAL");
    $db->exec("PRAGMA busy_timeout = 5000");

    $db->exec("CREATE TABLE IF NOT EXISTS voice_peers (
        room_id TEXT NOT NULL,
        peer_id TEXT NOT NULL,
        email TEXT,
        name TEXT,
        mic INTEGER DEFAULT 0,
        speaking INTEGER DEFAULT 0,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (room_id, peer_id)
    )");
    $db->exec("CREATE TABLE IF NOT EXISTS voice_signals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        room_id TEXT NOT NULL,
        to_peer TEXT NOT NULL,
        from_peer TEXT NOT NULL,
        msg_type TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at INTEGER NOT NULL
    )");
    $db->exec("CREATE INDEX IF NOT EXISTS voice_signals_room ON voice_signals (room_id, id)");
    // Thông tin phòng (tên, học phần) để người mở link phòng do người khác tạo vẫn thấy đúng tên
    $db->exec("CREATE TABLE IF NOT EXISTS voice_rooms (
        room_id TEXT PRIMARY KEY,
        name TEXT,
        course TEXT,
        focus INTEGER,
        brk INTEGER,
        updated_at INTEGER NOT NULL
    )");

    $now = time();
    if (mt_rand(1, 10) === 1) {
        $db->exec("DELETE FROM voice_peers WHERE updated_at < " . ($now - $PEER_TTL));
        $db->exec("DELETE FROM voice_signals WHERE created_at < " . ($now - $SIGNAL_TTL));
        $db->exec("DELETE FROM voice_rooms WHERE updated_at < " . ($now - 30 * 86400));
    }
} catch (Throwable $e) {
    error_log('voice_signal: ' . $e->getMessage());
    api_fail(500, 'Máy chủ voice tạm thời không xử lý được, thử lại sau.');
}

function vs_peers(PDO $db, string $roomId, int $now, int $ttl): array
{
    $st = $db->prepare("SELECT peer_id AS peerId, email, name, mic, speaking FROM voice_peers WHERE room_id = :r AND updated_at >= :t ORDER BY peer_id");
    $st->execute([':r' => $roomId, ':t' => $now - $ttl]);
    return array_map(function ($p) {
        $p['mic'] = (int)$p['mic'] === 1;
        $p['speaking'] = (int)$p['speaking'] === 1;
        return $p;
    }, $st->fetchAll(PDO::FETCH_ASSOC));
}
function vs_room(PDO $db, string $roomId)
{
    $st = $db->prepare("SELECT name, course, focus, brk FROM voice_rooms WHERE room_id = :r");
    $st->execute([':r' => $roomId]);
    $row = $st->fetch(PDO::FETCH_ASSOC);
    return $row ? ['name' => $row['name'], 'course' => $row['course'], 'focus' => (int)$row['focus'], 'brk' => (int)$row['brk']] : null;
}
function vs_touch(PDO $db, string $roomId, string $peerId, int $now, $mic = null, $speaking = null)
{
    if ($mic === null) {
        $db->prepare("UPDATE voice_peers SET updated_at = :u WHERE room_id = :r AND peer_id = :p")
           ->execute([':u' => $now, ':r' => $roomId, ':p' => $peerId]);
    } else {
        $db->prepare("UPDATE voice_peers SET updated_at = :u, mic = :m, speaking = :s WHERE room_id = :r AND peer_id = :p")
           ->execute([':u' => $now, ':m' => $mic ? 1 : 0, ':s' => $speaking ? 1 : 0, ':r' => $roomId, ':p' => $peerId]);
    }
}

if ($isPost && $action === 'join') {
    $roomId = vs_id($input['roomId'] ?? '');
    $peerId = vs_id($input['peerId'] ?? '');
    if (!$roomId || !$peerId) {
        api_fail(400, 'Thiếu mã phòng.');
    }
    $cnt = $db->prepare("SELECT COUNT(*) FROM voice_peers WHERE room_id = :r AND peer_id != :p AND updated_at >= :t");
    $cnt->execute([':r' => $roomId, ':p' => $peerId, ':t' => $now - $PEER_TTL]);
    if ((int)$cnt->fetchColumn() >= $MAX_PEERS) {
        api_fail(409, "Kênh thoại của phòng đã đủ {$MAX_PEERS} người.");
    }
    $db->prepare("INSERT INTO voice_peers (room_id, peer_id, email, name, mic, speaking, updated_at)
        VALUES (:r, :p, :e, :n, :m, 0, :u)
        ON CONFLICT(room_id, peer_id) DO UPDATE SET email = :e, name = :n, mic = :m, updated_at = :u")
       ->execute([
           ':r' => $roomId, ':p' => $peerId,
           ':e' => vs_text($input['email'] ?? '', 120), ':n' => vs_text($input['name'] ?? '', 80),
           ':m' => !empty($input['mic']) ? 1 : 0, ':u' => $now
       ]);
    // Người có phòng trên máy (thường là người tạo) gửi kèm tên phòng để người vào bằng link thấy đúng tên
    if (!empty($input['room']) && is_array($input['room']) && vs_text($input['room']['name'] ?? '', 60) !== '') {
        $room = $input['room'];
        $db->prepare("INSERT INTO voice_rooms (room_id, name, course, focus, brk, updated_at) VALUES (:r, :n, :c, :f, :b, :u)
            ON CONFLICT(room_id) DO UPDATE SET name = :n, course = :c, focus = :f, brk = :b, updated_at = :u")
           ->execute([
               ':r' => $roomId, ':n' => vs_text($room['name'], 60),
               ':c' => preg_match('/^[A-Z]{2,4}\d{3,4}[A-Z]?$/', (string)($room['course'] ?? '')) ? $room['course'] : '',
               ':f' => in_array((int)($room['focus'] ?? 25), [25, 45, 50], true) ? (int)$room['focus'] : 25,
               ':b' => in_array((int)($room['brk'] ?? 5), [5, 10, 15], true) ? (int)$room['brk'] : 5,
               ':u' => $now
           ]);
    }
    // Người mới chỉ cần tín hiệu từ lúc vào phòng trở đi
    $max = $db->prepare("SELECT COALESCE(MAX(id), 0) FROM voice_signals");
    $max->execute();
    vs_out([
        'ok' => true,
        'peers' => vs_peers($db, $roomId, $now, $PEER_TTL),
        'room' => vs_room($db, $roomId),
        'maxId' => (int)$max->fetchColumn(),
        'ttl' => $PEER_TTL
    ]);
}

if ($isPost && $action === 'send') {
    $roomId = vs_id($input['roomId'] ?? '');
    $fromPeer = vs_id($input['fromPeer'] ?? '');
    $toPeer = isset($input['toPeer']) && $input['toPeer'] !== 'ALL' ? vs_id($input['toPeer']) : 'ALL';
    $msgType = in_array($input['msgType'] ?? '', $VS_TYPES, true) ? $input['msgType'] : '';
    $payload = json_encode($input['payload'] ?? new stdClass());
    if (!$roomId || !$fromPeer || !$toPeer || !$msgType || strlen($payload) > 32768) {
        api_fail(400, 'Tín hiệu không hợp lệ.');
    }
    // Chỉ người đang ở trong phòng mới gửi tín hiệu được
    $in = $db->prepare("SELECT 1 FROM voice_peers WHERE room_id = :r AND peer_id = :p");
    $in->execute([':r' => $roomId, ':p' => $fromPeer]);
    if (!$in->fetchColumn()) {
        api_fail(410, 'Bạn đã rời kênh thoại, hãy vào lại.', ['rejoin' => true]);
    }
    $db->prepare("INSERT INTO voice_signals (room_id, to_peer, from_peer, msg_type, payload, created_at) VALUES (:r, :to, :from, :type, :payload, :t)")
       ->execute([':r' => $roomId, ':to' => $toPeer, ':from' => $fromPeer, ':type' => $msgType, ':payload' => $payload, ':t' => $now]);
    $id = (int)$db->lastInsertId();
    vs_touch($db, $roomId, $fromPeer, $now);
    vs_out(['ok' => true, 'signalId' => $id]);
}

if ($isPost && $action === 'leave') {
    $roomId = vs_id($input['roomId'] ?? '');
    $peerId = vs_id($input['peerId'] ?? '');
    if ($roomId && $peerId) {
        $db->prepare("DELETE FROM voice_peers WHERE room_id = :r AND peer_id = :p")->execute([':r' => $roomId, ':p' => $peerId]);
        $db->prepare("INSERT INTO voice_signals (room_id, to_peer, from_peer, msg_type, payload, created_at) VALUES (:r, 'ALL', :p, 'leave', '{}', :t)")
           ->execute([':r' => $roomId, ':p' => $peerId, ':t' => $now]);
    }
    vs_out(['ok' => true]);
}

if (!$isPost && $action === 'poll') {
    $roomId = vs_id($_GET['roomId'] ?? '');
    $peerId = vs_id($_GET['peerId'] ?? '');
    $since = max(0, (int)($_GET['since'] ?? 0));
    if (!$roomId || !$peerId) {
        api_fail(400, 'Thiếu mã phòng.');
    }
    $in = $db->prepare("SELECT 1 FROM voice_peers WHERE room_id = :r AND peer_id = :p AND updated_at >= :t");
    $in->execute([':r' => $roomId, ':p' => $peerId, ':t' => $now - $PEER_TTL]);
    if (!$in->fetchColumn()) {
        // Bị coi là đã rời (tab ngủ lâu, mất mạng): trình duyệt sẽ tự vào lại
        api_fail(410, 'Bạn đã rời kênh thoại, hãy vào lại.', ['rejoin' => true]);
    }
    // Trạng thái mic/đang nói đi kèm mỗi lượt poll, không cần gửi tín hiệu riêng
    vs_touch($db, $roomId, $peerId, $now, !empty($_GET['mic']), !empty($_GET['speaking']));

    $st = $db->prepare("SELECT id, from_peer, to_peer, msg_type, payload FROM voice_signals
        WHERE room_id = :r AND id > :s AND from_peer != :p AND (to_peer = 'ALL' OR to_peer = :p)
        ORDER BY id ASC LIMIT 100");
    $st->execute([':r' => $roomId, ':s' => $since, ':p' => $peerId]);
    $signals = [];
    $maxId = $since;
    foreach ($st->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $signals[] = [
            'id' => (int)$row['id'],
            'from' => $row['from_peer'],
            'to' => $row['to_peer'],
            'type' => $row['msg_type'],
            'payload' => json_decode($row['payload'], true)
        ];
        $maxId = max($maxId, (int)$row['id']);
    }
    vs_out(['ok' => true, 'signals' => $signals, 'peers' => vs_peers($db, $roomId, $now, $PEER_TTL), 'maxId' => $maxId]);
}

api_fail(400, 'Yêu cầu không hợp lệ.');
