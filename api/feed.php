<?php
// api/feed.php - Cung cap va tu dong cap nhat thong bao van HUST moi 30 phut
require_once __DIR__ . '/_security.php';

api_headers(['GET', 'POST']);

$dataFile = __DIR__ . '/../data/hust-feed.json';
$refresh = isset($_GET['refresh']) && $_GET['refresh'] === '1';

// Doc du lieu hien tai
$feed = null;
$mtime = 0;
if (file_exists($dataFile)) {
    $mtime = filemtime($dataFile);
    $raw = @file_get_contents($dataFile);
    if ($raw) {
        $feed = @json_decode($raw, true);
    }
}

$now = time();
// Cap nhat neu: chua co file, hoac co tham so ?refresh=1, hoac file cu hon 30 phut (1800 giay)
$needsUpdate = ($feed === null) || $refresh || (($now - $mtime) >= 1800);

if ($needsUpdate) {
    $updatedFeed = fetch_hust_feed_from_sources($feed);
    if ($updatedFeed !== null && !empty($updatedFeed['items'])) {
        $feed = $updatedFeed;
        @file_put_contents($dataFile, json_encode($feed, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    }
}

if (!$feed) {
    $feed = [
        'source' => 'https://ctt.hust.edu.vn',
        'fetchedAt' => date('c'),
        'items' => []
    ];
}

echo json_encode($feed, JSON_UNESCAPED_UNICODE);
exit;

function fetch_hust_feed_from_sources($previous) {
    $base = 'https://ctt.hust.edu.vn';
    $sources = [
        ['path' => '/', 'source' => 'Trang chủ'],
        ['path' => '/DisplayWeb/DisplayListBaiViet?tag=ĐTĐH', 'source' => 'Thông báo đại học'],
        ['path' => '/DisplayWeb/DisplayListBaiViet?tag=ĐTĐH&page=2', 'source' => 'Thông báo đại học'],
        ['path' => '/DisplayWeb/DisplayQuyChe?tag=ĐTĐH', 'source' => 'Quy định đại học']
    ];

    $known = [];
    if (!empty($previous['items'])) {
        foreach ($previous['items'] as $item) {
            if (!empty($item['url'])) {
                $known[$item['url']] = $item;
            }
        }
    }

    $foundCount = 0;
    $errors = [];
    $nowIso = date('c');

    foreach ($sources as $src) {
        $url = $base . $src['path'];
        $html = http_get_ctt($url);
        if (!$html) {
            $errors[] = "Không tải được " . $src['path'];
            continue;
        }

        $items = parse_ctt_html($html, $src['source'], $base);
        $foundCount += count($items);

        foreach ($items as $item) {
            $u = $item['url'];
            $old = $known[$u] ?? null;
            $known[$u] = [
                'url' => $u,
                'title' => $item['title'],
                'date' => $item['date'] ?? ($old['date'] ?? null),
                'source' => $item['source'],
                'tags' => tags_for_title($item['title']),
                'firstSeen' => $old['firstSeen'] ?? $nowIso
            ];
        }
    }

    if ($foundCount === 0 && !empty($previous['items'])) {
        return $previous;
    }

    $all = array_values($known);
    usort($all, function ($a, $b) {
        $da = $a['date'] ?? $a['firstSeen'] ?? '';
        $db = $b['date'] ?? $b['firstSeen'] ?? '';
        return strcmp($db, $da);
    });

    $sliced = array_slice($all, 0, 300);

    return [
        'source' => $base,
        'fetchedAt' => $nowIso,
        'errors' => $errors,
        'items' => $sliced
    ];
}

function http_get_ctt($url) {
    if (!function_exists('curl_init')) {
        $opts = [
            'http' => [
                'method' => 'GET',
                'header' => "User-Agent: HUSTDOCU-feed/1.0 (+https://github.com/khanhhoang23072006-ux/khotl)\r\nAccept: text/html\r\n",
                'timeout' => 12
            ]
        ];
        return @file_get_contents($url, false, stream_context_create($opts));
    }
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_USERAGENT, 'HUSTDOCU-feed/1.0 (+https://github.com/khanhhoang23072006-ux/khotl)');
    curl_setopt($ch, CURLOPT_TIMEOUT, 15);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    $out = curl_exec($ch);
    curl_close($ch);
    return $out ?: null;
}

function parse_ctt_html($html, $source, $base) {
    $items = [];
    $pattern = '/<a\b[^>]*href="([^"]*Display(?:BaiViet|Kehoach)\?[^"]+)"[^>]*>([\s\S]*?)<\/a>/i';
    if (!preg_match_all($pattern, $html, $matches, PREG_SET_ORDER | PREG_OFFSET_CAPTURE)) {
        return $items;
    }

    foreach ($matches as $m) {
        $href = html_entity_decode($m[1][0], ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $fullUrl = (strpos($href, 'http') === 0) ? $href : rtrim($base, '/') . '/' . ltrim($href, '/');
        $rawTitle = strip_tags($m[2][0]);
        $title = trim(preg_replace('/\s+/', ' ', html_entity_decode($rawTitle, ENT_QUOTES | ENT_HTML5, 'UTF-8')));

        if (mb_strlen($title, 'UTF-8') < 8) continue;

        $date = null;
        if (preg_match('/(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})/', $title, $dm)) {
            $date = sprintf('%04d-%02d-%02d', (int)$dm[3], (int)$dm[2], (int)$dm[1]);
        } else {
            $offset = $m[0][1];
            $len = strlen($m[0][0]);
            $start = max(0, $offset - 400);
            $before = strip_tags(substr($html, $start, $offset - $start));
            $after = strip_tags(substr($html, $offset + $len, 400));
            if (preg_match_all('/\d{1,2}[.\/-]\d{1,2}[.\/-]\d{4}/', $before, $bm)) {
                $last = end($bm[0]);
                if (preg_match('/(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})/', $last, $p)) {
                    $date = sprintf('%04d-%02d-%02d', (int)$p[3], (int)$p[2], (int)$p[1]);
                }
            } elseif (preg_match('/(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})/', $after, $am)) {
                $date = sprintf('%04d-%02d-%02d', (int)$am[3], (int)$am[2], (int)$am[1]);
            }
        }

        if (!isset($items[$fullUrl]) || mb_strlen($title, 'UTF-8') > mb_strlen($items[$fullUrl]['title'], 'UTF-8')) {
            $items[$fullUrl] = [
                'url' => $fullUrl,
                'title' => $title,
                'date' => $date,
                'source' => $source
            ];
        }
    }

    return array_values($items);
}

function tags_for_title($title) {
    $t = plain_vn($title);
    $rules = [
        'ctdt' => '/chuong trinh dao tao|ctdt|khung chuong trinh|chuan dau ra/',
        'decuong' => '/de cuong|syllabus/',
        'dangky' => '/dang ky (hoc tap|lop|ke hoach|hoc phan)|ke hoach hoc tap|dang ky tot nghiep/',
        'lichthi' => '/lich thi|thi cuoi ky|thi giua ky|kiem tra tieng anh|ky thi/',
        'hocphi' => '/hoc phi/',
        'hocbong' => '/hoc bong|khen thuong/',
        'quyche' => '/quy che|quy dinh|huong dan|regulation/'
    ];
    $tags = [];
    foreach ($rules as $tag => $pattern) {
        if (preg_match($pattern, $t)) {
            $tags[] = $tag;
        }
    }
    return $tags;
}

function plain_vn($str) {
    $str = preg_replace("/(à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ)/u", 'a', $str);
    $str = preg_replace("/(è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ)/u", 'e', $str);
    $str = preg_replace("/(ì|í|ị|ỉ|ĩ)/u", 'i', $str);
    $str = preg_replace("/(ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ)/u", 'o', $str);
    $str = preg_replace("/(ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ)/u", 'u', $str);
    $str = preg_replace("/(ỳ|ý|ỵ|ỷ|ỹ)/u", 'y', $str);
    $str = preg_replace("/(đ)/u", 'd', $str);
    $str = preg_replace("/(À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ)/u", 'a', $str);
    $str = preg_replace("/(È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ)/u", 'e', $str);
    $str = preg_replace("/(Ì|Í|Ị|Ỉ|Ĩ)/u", 'i', $str);
    $str = preg_replace("/(Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ)/u", 'o', $str);
    $str = preg_replace("/(Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ)/u", 'u', $str);
    $str = preg_replace("/(Ỳ|Ý|Ỵ|Ỷ|Ỹ)/u", 'y', $str);
    $str = preg_replace("/(Đ)/u", 'd', $str);
    return strtolower($str);
}
