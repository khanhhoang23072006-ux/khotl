<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=UTF-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$dbDir = __DIR__ . '/data';
if (!is_dir($dbDir)) {
    @mkdir($dbDir, 0755, true);
    @file_put_contents($dbDir . '/.htaccess', "Order Deny,Allow\nDeny from all\n");
}

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
    http_response_code(500);
    echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
    exit;
}

$action = isset($_GET['action']) ? $_GET['action'] : '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true) ?: [];

    if ($action === 'heartbeat' || $action === 'join') {
        $roomId = isset($input['roomId']) ? trim($input['roomId']) : '';
        $peerId = isset($input['peerId']) ? trim($input['peerId']) : '';
        $email = isset($input['email']) ? trim($input['email']) : '';
        $name = isset($input['name']) ? trim($input['name']) : '';
        $mic = !empty($input['mic']) ? 1 : 0;
        $speaking = !empty($input['speaking']) ? 1 : 0;

        if (!$roomId || !$peerId) {
            echo json_encode(['error' => 'Missing roomId or peerId']);
            exit;
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
        $roomId = isset($input['roomId']) ? trim($input['roomId']) : '';
        $fromPeer = isset($input['fromPeer']) ? trim($input['fromPeer']) : '';
        $toPeer = isset($input['toPeer']) ? trim($input['toPeer']) : 'ALL';
        $msgType = isset($input['msgType']) ? trim($input['msgType']) : '';
        $payload = isset($input['payload']) ? json_encode($input['payload']) : '{}';

        if (!$roomId || !$fromPeer || !$msgType) {
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
        $roomId = isset($input['roomId']) ? trim($input['roomId']) : '';
        $peerId = isset($input['peerId']) ? trim($input['peerId']) : '';

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
    $roomId = isset($_GET['roomId']) ? trim($_GET['roomId']) : '';
    $peerId = isset($_GET['peerId']) ? trim($_GET['peerId']) : '';
    $since = isset($_GET['since']) ? (int)$_GET['since'] : 0;

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
