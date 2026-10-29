<?php
require_once __DIR__ . '/_security.php';
api_headers(['GET', 'POST']);

$dbDir = __DIR__ . '/data';
api_data_dir();
if (!file_exists($dbDir . '/.htaccess')) {
    @file_put_contents($dbDir . '/.htaccess', "<IfModule mod_authz_core.c>\nRequire all denied\n</IfModule>\n<IfModule !mod_authz_core.c>\nOrder Deny,Allow\nDeny from all\n</IfModule>\n");
}

// Giới hạn: mỗi IP tối đa 600 yêu cầu/phút (poll mỗi giây vẫn dư), dữ liệu đầu vào ngắn gọn
$wait = rate_limit('voice-ip', client_ip(), 600, 60);
if ($wait > 0) {
    api_fail(429, 'Quá nhiều yêu cầu.', ['retry_after' => $wait]);
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
$VS_TYPES = ['join', 'welcome', 'state', 'leave', 'offer', 'answer', 'ice', 'mic-on', 'mic-off'];

$dbPath = $dbDir . '/voice_signal.db';
try {
    $db = new PDO("sqlite:$dbPath");
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $db->exec("PRAGMA journal_mode = WAL");
    $db->exec("PRAGMA synchronous = NORMAL");

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

    // Auto cleanup old peers (inactive > 15s) and old signals (> 60s)
    $now = time();
    $db->exec("DELETE FROM voice_peers WHERE updated_at < " . ($now - 15));
    $db->exec("DELETE FROM voice_signals WHERE created_at < " . ($now - 60));

} catch (Exception $e) {
    error_log('voice_signal: ' . $e->getMessage());
    api_fail(500, 'Máy chủ tạm thời không xử lý được, thử lại sau.');
}

$action = isset($_GET['action']) ? $_GET['action'] : '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $rawBody = file_get_contents('php://input', false, null, 0, 65536);
    $input = json_decode($rawBody, true) ?: [];

    if ($action === 'heartbeat' || $action === 'join') {
        $roomId = vs_id($input['roomId'] ?? '');
        $peerId = vs_id($input['peerId'] ?? '');
        $email = vs_text($input['email'] ?? '', 120);
        $name = vs_text($input['name'] ?? '', 80);
        $mic = !empty($input['mic']) ? 1 : 0;
        $speaking = !empty($input['speaking']) ? 1 : 0;

        if (!$roomId || !$peerId) {
            echo json_encode(['error' => 'Missing roomId or peerId']);
            exit;
        }

        $cnt = $db->prepare("SELECT COUNT(*) FROM voice_peers WHERE room_id = :r AND peer_id != :p");
        $cnt->execute([':r' => $roomId, ':p' => $peerId]);
        if ((int)$cnt->fetchColumn() >= 30) {
            api_fail(409, 'Phòng đã đủ 30 người.');
        }
        $stmt = $db->prepare("INSERT INTO voice_peers (room_id, peer_id, email, name, mic, speaking, updated_at) 
            VALUES (:r, :p, :e, :n, :m, :s, :u) 
            ON CONFLICT(room_id, peer_id) DO UPDATE SET 
            email = :e, name = :n, mic = :m, speaking = :s, updated_at = :u");
        $stmt->execute([
            ':r' => $roomId,
            ':p' => $peerId,
            ':e' => $email,
            ':n' => $name,
            ':m' => $mic,
            ':s' => $speaking,
            ':u' => $now
        ]);

        // If joining, broadcast 'join' signal to existing peers
        if ($action === 'join') {
            $joinSig = $db->prepare("INSERT INTO voice_signals (room_id, to_peer, from_peer, msg_type, payload, created_at) 
                VALUES (:r, 'ALL', :p, 'join', :payload, :t)");
            $joinSig->execute([
                ':r' => $roomId,
                ':p' => $peerId,
                ':payload' => json_encode(['email' => $email, 'name' => $name, 'mic' => (bool)$mic, 'speaking' => (bool)$speaking]),
                ':t' => $now
            ]);
        }

        // Return current active peers
        $peersStmt = $db->prepare("SELECT peer_id as peerId, email, name, mic, speaking FROM voice_peers WHERE room_id = :r");
        $peersStmt->execute([':r' => $roomId]);
        $peers = $peersStmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode(['ok' => true, 'peers' => $peers]);
        exit;
    }

    if ($action === 'send') {
        $roomId = vs_id($input['roomId'] ?? '');
        $fromPeer = vs_id($input['fromPeer'] ?? '');
        $toPeer = isset($input['toPeer']) && $input['toPeer'] !== 'ALL' ? vs_id($input['toPeer']) : 'ALL';
        $msgType = in_array($input['msgType'] ?? '', $VS_TYPES, true) ? $input['msgType'] : '';
        $payload = isset($input['payload']) ? json_encode($input['payload']) : '{}';

        if (!$roomId || !$fromPeer || !$toPeer || !$msgType || strlen($payload) > 32768) {
            echo json_encode(['error' => 'Invalid signal parameters']);
            exit;
        }

        $stmt = $db->prepare("INSERT INTO voice_signals (room_id, to_peer, from_peer, msg_type, payload, created_at) 
            VALUES (:r, :to, :from, :type, :payload, :t)");
        $stmt->execute([
            ':r' => $roomId,
            ':to' => $toPeer,
            ':from' => $fromPeer,
            ':type' => $msgType,
            ':payload' => $payload,
            ':t' => $now
        ]);

        // Keep peer alive
        $db->prepare("UPDATE voice_peers SET updated_at = :u WHERE room_id = :r AND peer_id = :p")
           ->execute([':u' => $now, ':r' => $roomId, ':p' => $fromPeer]);

        echo json_encode(['ok' => true, 'signalId' => (int)$db->lastInsertId()]);
        exit;
    }

    if ($action === 'leave') {
        $roomId = vs_id($input['roomId'] ?? '');
        $peerId = vs_id($input['peerId'] ?? '');

        if ($roomId && $peerId) {
            $db->prepare("DELETE FROM voice_peers WHERE room_id = :r AND peer_id = :p")->execute([':r' => $roomId, ':p' => $peerId]);
            $db->prepare("INSERT INTO voice_signals (room_id, to_peer, from_peer, msg_type, payload, created_at) VALUES (:r, 'ALL', :p, 'leave', '{}', :t)")
               ->execute([':r' => $roomId, ':p' => $peerId, ':t' => $now]);
        }
        echo json_encode(['ok' => true]);
        exit;
    }
}

if ($_SERVER['REQUEST_METHOD'] === 'GET' && $action === 'poll') {
    $roomId = vs_id($_GET['roomId'] ?? '');
    $peerId = vs_id($_GET['peerId'] ?? '');
    $since = isset($_GET['since']) ? max(0, (int)$_GET['since']) : 0;

    if (!$roomId) {
        echo json_encode(['error' => 'Missing roomId']);
        exit;
    }

    // Select incoming signals for this peer
    $sigStmt = $db->prepare("SELECT id, to_peer as toPeer, from_peer as fromPeer, msg_type as msgType, payload 
        FROM voice_signals 
        WHERE room_id = :r AND id > :s AND from_peer != :p AND (to_peer = 'ALL' OR to_peer = :p) 
        ORDER BY id ASC LIMIT 50");
    $sigStmt->execute([':r' => $roomId, ':s' => $since, ':p' => $peerId]);
    $rawSignals = $sigStmt->fetchAll(PDO::FETCH_ASSOC);

    $signals = [];
    $maxId = $since;
    foreach ($rawSignals as $row) {
        $signals[] = [
            'id' => (int)$row['id'],
            'from' => $row['fromPeer'],
            'to' => $row['toPeer'],
            'type' => $row['msgType'],
            'payload' => json_decode($row['payload'], true)
        ];
        if ((int)$row['id'] > $maxId) {
            $maxId = (int)$row['id'];
        }
    }

    // Get active room peers
    $peersStmt = $db->prepare("SELECT peer_id as peerId, email, name, mic, speaking FROM voice_peers WHERE room_id = :r");
    $peersStmt->execute([':r' => $roomId]);
    $peers = $peersStmt->fetchAll(PDO::FETCH_ASSOC);

    // Keep querying peer alive if peerId is given
    if ($peerId) {
        $db->prepare("UPDATE voice_peers SET updated_at = :u WHERE room_id = :r AND peer_id = :p")
           ->execute([':u' => $now, ':r' => $roomId, ':p' => $peerId]);
    }

    echo json_encode([
        'ok' => true,
        'signals' => $signals,
        'peers' => $peers,
        'maxId' => $maxId
    ]);
    exit;
}

echo json_encode(['error' => 'Invalid action']);
