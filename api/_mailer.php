<?php
// Gửi email qua SMTP (Gmail hoặc SMTP của hosting) trực tiếp từ PHP, không cần thư viện ngoài.
// File này chỉ khai báo hàm; gọi trực tiếp không làm gì.
if (basename($_SERVER['SCRIPT_FILENAME'] ?? '') === basename(__FILE__)) {
    http_response_code(404);
    exit;
}

/** Tiêu đề, tên người gửi có dấu tiếng Việt phải mã hoá theo RFC 2047, không thì hộp thư hiện lỗi font. */
function mail_header_text(string $text): string
{
    return preg_match('/[^\x20-\x7E]/', $text) ? '=?UTF-8?B?' . base64_encode($text) . '?=' : $text;
}

/**
 * Dựng thư MIME đủ header (Date, Message-ID, bản text + HTML) để Gmail, Outlook không xếp vào Spam.
 * Trả về [header + thân thư] dạng CRLF, chưa có dấu chấm kết thúc của SMTP.
 */
function mail_build(string $fromEmail, string $fromName, string $to, string $subject, string $text, string $html): string
{
    $domain = substr(strrchr($fromEmail, '@') ?: '@localhost', 1);
    $boundary = 'b' . bin2hex(random_bytes(12));
    $lines = [
        'Date: ' . date('r'),
        'Message-ID: <' . bin2hex(random_bytes(16)) . '@' . $domain . '>',
        'From: ' . mail_header_text($fromName) . ' <' . $fromEmail . '>',
        'To: <' . $to . '>',
        'Subject: ' . mail_header_text($subject),
        'MIME-Version: 1.0',
        'Content-Type: multipart/alternative; boundary="' . $boundary . '"',
        '',
        '--' . $boundary,
        'Content-Type: text/plain; charset=UTF-8',
        'Content-Transfer-Encoding: base64',
        '',
        rtrim(chunk_split(base64_encode($text), 76, "\r\n")),
        '--' . $boundary,
        'Content-Type: text/html; charset=UTF-8',
        'Content-Transfer-Encoding: base64',
        '',
        rtrim(chunk_split(base64_encode($html), 76, "\r\n")),
        '--' . $boundary . '--',
    ];
    return implode("\r\n", $lines);
}

/** Đọc một phản hồi SMTP (có thể nhiều dòng "250-...") và trả mã số. */
function smtp_read($fp, string &$last): int
{
    $last = '';
    while (($line = fgets($fp, 1024)) !== false) {
        $last .= $line;
        // Dòng cuối của phản hồi có dạng "250 ..." (dấu cách sau mã)
        if (strlen($line) < 4 || $line[3] === ' ') {
            break;
        }
    }
    return (int)substr($last, 0, 3);
}

function smtp_cmd($fp, string $cmd, array $expect, string $what): void
{
    if ($cmd !== '') {
        fwrite($fp, $cmd . "\r\n");
    }
    $reply = '';
    $code = smtp_read($fp, $reply);
    if (!in_array($code, $expect, true)) {
        throw new RuntimeException("SMTP {$what}: " . trim($reply ?: 'không có phản hồi'));
    }
}

/**
 * Gửi thư qua SMTP. $cfg: host, port, secure ('ssl' = SSL ngay từ đầu như cổng 465, 'tls' = STARTTLS như cổng 587;
 * mặc định theo cổng), user, pass, from (mặc định = user), from_name.
 * Ném RuntimeException kèm lý do nếu thất bại (lý do chỉ ghi log máy chủ, không trả cho người dùng).
 */
function smtp_send(array $cfg, string $to, string $subject, string $text, string $html): void
{
    $host = $cfg['host'] ?? 'smtp.gmail.com';
    $port = (int)($cfg['port'] ?? 465);
    $ssl = ($cfg['secure'] ?? ($port === 465 ? 'ssl' : 'tls')) === 'ssl';
    $user = (string)($cfg['user'] ?? '');
    $pass = preg_replace('/\s+/', '', (string)($cfg['pass'] ?? ''));
    $from = (string)($cfg['from'] ?? $user);
    $fromName = (string)($cfg['from_name'] ?? 'HUSTDOCU');
    if ($user === '' || $pass === '') {
        throw new RuntimeException('Chưa cấu hình SMTP');
    }
    // Chặn chèn lệnh SMTP qua địa chỉ email
    if (preg_match('/[\r\n<>]/', $to . $from)) {
        throw new RuntimeException('Địa chỉ email không hợp lệ');
    }

    $ctx = stream_context_create(['ssl' => ['verify_peer' => true, 'verify_peer_name' => true, 'SNI_enabled' => true]]);
    $remote = ($ssl ? 'ssl://' : 'tcp://') . $host . ':' . $port;
    $errno = 0;
    $errstr = '';
    $fp = @stream_socket_client($remote, $errno, $errstr, 8, STREAM_CLIENT_CONNECT, $ctx);
    if (!$fp) {
        throw new RuntimeException("Không kết nối được {$host}:{$port} ({$errstr})");
    }
    stream_set_timeout($fp, 10);
    try {
        smtp_cmd($fp, '', [220], 'chào');
        $ehlo = 'EHLO ' . (preg_replace('/[^A-Za-z0-9.\-]/', '', $_SERVER['SERVER_NAME'] ?? '') ?: 'localhost');
        smtp_cmd($fp, $ehlo, [250], 'EHLO');
        if (!$ssl) {
            smtp_cmd($fp, 'STARTTLS', [220], 'STARTTLS');
            if (!stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT | (defined('STREAM_CRYPTO_METHOD_TLSv1_3_CLIENT') ? STREAM_CRYPTO_METHOD_TLSv1_3_CLIENT : 0))) {
                throw new RuntimeException('Không bật được TLS');
            }
            smtp_cmd($fp, $ehlo, [250], 'EHLO sau TLS');
        }
        smtp_cmd($fp, 'AUTH LOGIN', [334], 'AUTH');
        smtp_cmd($fp, base64_encode($user), [334], 'tài khoản');
        smtp_cmd($fp, base64_encode($pass), [235], 'mật khẩu ứng dụng (sai hoặc đã bị thu hồi?)');
        smtp_cmd($fp, "MAIL FROM:<{$from}>", [250], 'MAIL FROM');
        smtp_cmd($fp, "RCPT TO:<{$to}>", [250, 251], 'RCPT TO');
        smtp_cmd($fp, 'DATA', [354], 'DATA');
        $body = mail_build($from, $fromName, $to, $subject, $text, $html);
        // Dòng bắt đầu bằng dấu chấm phải nhân đôi (dot-stuffing)
        $body = preg_replace('/^\./m', '..', $body);
        smtp_cmd($fp, $body . "\r\n.", [250], 'gửi thư');
        fwrite($fp, "QUIT\r\n");
    } finally {
        fclose($fp);
    }
}

/** Nội dung thư mã OTP (text + HTML) dùng chung cho mọi cách gửi. */
function otp_mail_content(string $otp): array
{
    $subject = "Mã xác thực HUSTDOCU: {$otp}";
    $text = "Mã xác thực đăng nhập HUSTDOCU của bạn là: {$otp}\r\n\r\nMã có hiệu lực trong 10 phút. Nếu bạn không yêu cầu mã này, hãy bỏ qua email.";
    $html = '<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;border:2px solid #111;padding:24px;background:#fff">'
        . '<h2 style="margin:0 0 16px;color:#D7263D">HUSTDOCU</h2>'
        . '<p>Mã xác thực đăng nhập của bạn là:</p>'
        . '<div style="font-size:32px;font-weight:bold;letter-spacing:6px;color:#111;padding:16px 0;text-align:center;background:#f4f4f4;border:1px dashed #999;margin:16px 0">' . htmlspecialchars($otp) . '</div>'
        . '<p style="font-size:13px;color:#555">Mã có hiệu lực trong 10 phút. Nếu bạn không yêu cầu mã này, hãy bỏ qua email.</p>'
        . '</div>';
    return [$subject, $text, $html];
}
