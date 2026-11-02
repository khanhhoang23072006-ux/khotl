<?php
header('Content-Type: application/xml; charset=utf-8');

$domain = 'https://www.hustdocu.id.vn';
$today = date('Y-m-d');

$staticPages = [
    ['loc' => $domain . '/', 'changefreq' => 'daily', 'priority' => '1.0'],
    ['loc' => $domain . '/?p=/tim-kiem', 'changefreq' => 'daily', 'priority' => '0.9'],
    ['loc' => $domain . '/?p=/hoc-tap', 'changefreq' => 'daily', 'priority' => '0.9'],
    ['loc' => $domain . '/?p=/vien', 'changefreq' => 'weekly', 'priority' => '0.9'],
    ['loc' => $domain . '/?p=/cong-dong', 'changefreq' => 'daily', 'priority' => '0.8'],
    ['loc' => $domain . '/?p=/bang-xep-hang', 'changefreq' => 'daily', 'priority' => '0.8'],
    ['loc' => $domain . '/?p=/tro-ly', 'changefreq' => 'weekly', 'priority' => '0.8'],
    ['loc' => $domain . '/?p=/tai-len', 'changefreq' => 'weekly', 'priority' => '0.8'],
    ['loc' => $domain . '/?p=/extension', 'changefreq' => 'monthly', 'priority' => '0.7'],
    ['loc' => $domain . '/?p=/lich', 'changefreq' => 'weekly', 'priority' => '0.7'],
    ['loc' => $domain . '/?p=/xep-lich', 'changefreq' => 'weekly', 'priority' => '0.7'],
    ['loc' => $domain . '/?p=/on-tap', 'changefreq' => 'weekly', 'priority' => '0.8'],
    ['loc' => $domain . '/?p=/flashcard', 'changefreq' => 'weekly', 'priority' => '0.7'],
    ['loc' => $domain . '/?p=/hoc-chung', 'changefreq' => 'daily', 'priority' => '0.7'],
    ['loc' => $domain . '/?p=/hoi-dap', 'changefreq' => 'daily', 'priority' => '0.8'],
    ['loc' => $domain . '/?p=/khong-gian', 'changefreq' => 'weekly', 'priority' => '0.7'],
    ['loc' => $domain . '/?p=/thong-bao-truong', 'changefreq' => 'daily', 'priority' => '0.8'],
    ['loc' => $domain . '/?p=/vinh-danh', 'changefreq' => 'weekly', 'priority' => '0.7'],
    ['loc' => $domain . '/?p=/dieu-khoan', 'changefreq' => 'monthly', 'priority' => '0.5'],
    ['loc' => $domain . '/?p=/quyen-rieng-tu', 'changefreq' => 'monthly', 'priority' => '0.5'],
    ['loc' => $domain . '/?p=/go-tai-lieu', 'changefreq' => 'monthly', 'priority' => '0.5'],
    ['loc' => $domain . '/?p=/minh-bach', 'changefreq' => 'monthly', 'priority' => '0.5'],
    ['loc' => $domain . '/?p=/cong-tac-vien', 'changefreq' => 'monthly', 'priority' => '0.6'],
];

// Load faculties & courses from index.html if possible or hardcoded fallback
$faculties = ['soict', 'smee', 'seee', 'sce', 'sme', 'sbft', 'sfl', 'sem', 'fms', 'sep'];
$facultyPages = array_map(function($f) use ($domain) {
    return ['loc' => $domain . '/?p=/vien/' . $f, 'changefreq' => 'weekly', 'priority' => '0.8'];
}, $faculties);

// Load documents from json file
$docPages = [];
$docsFile = __DIR__ . '/data/docs/documents.json';
if (file_exists($docsFile)) {
    $raw = @file_get_contents($docsFile);
    $arr = json_decode($raw, true);
    if (is_array($arr)) {
        foreach ($arr as $doc) {
            if (($doc['status'] ?? '') === 'APPROVED' && !empty($doc['slug'])) {
                $docPages[] = [
                    'loc' => $domain . '/?p=/tai-lieu/' . urlencode($doc['slug']),
                    'lastmod' => !empty($doc['updatedAt']) ? substr($doc['updatedAt'], 0, 10) : $today,
                    'changefreq' => 'weekly',
                    'priority' => '0.8'
                ];
            }
        }
    }
}

$all = array_merge($staticPages, $facultyPages, $docPages);

echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
echo '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";

foreach ($all as $item) {
    echo "  <url>\n";
    echo "    <loc>" . htmlspecialchars($item['loc'], ENT_XML1, 'UTF-8') . "</loc>\n";
    echo "    <lastmod>" . ($item['lastmod'] ?? $today) . "</lastmod>\n";
    echo "    <changefreq>" . ($item['changefreq'] ?? 'weekly') . "</changefreq>\n";
    echo "    <priority>" . ($item['priority'] ?? '0.8') . "</priority>\n";
    echo "  </url>\n";
}

echo '</urlset>';

