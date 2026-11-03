import fs from 'fs';
import path from 'path';

const ROOT_DIR = 'C:/Users/Asus/.gemini/antigravity-ide/scratch/khotl';
const INDEX_HTML_PATH = path.join(ROOT_DIR, 'index.html');
const DOMAIN = 'https://www.hustdocu.id.vn';

async function generate() {
  console.log('1. Reading faculties and courses from index.html...');
  const htmlContent = fs.readFileSync(INDEX_HTML_PATH, 'utf8');
  const dataMatch = htmlContent.match(/const DATA\s*=\s*(\{[\s\S]*?\n\};)/);
  if (!dataMatch) {
    throw new Error('Cannot find const DATA in index.html');
  }
  const DATA = new Function(`return ${dataMatch[1].replace(/;$/, '')}`)();
  const faculties = DATA.faculties || [];
  const courses = DATA.courses || [];
  console.log(`Found ${faculties.length} faculties and ${courses.length} courses.`);

  console.log('2. Fetching live documents from server...');
  let docs = [];
  try {
    const res = await fetch(`${DOMAIN}/api/docs.php?action=list`);
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.docs)) {
        docs = data.docs.filter(d => d.status === 'APPROVED');
      }
    }
  } catch (e) {
    console.warn('Could not fetch remote docs, falling back to empty list:', e.message);
  }
  console.log(`Found ${docs.length} approved documents.`);

  const today = new Date().toISOString().split('T')[0];

  const staticPages = [
    { loc: `${DOMAIN}/`, changefreq: 'daily', priority: '1.0' },
    { loc: `${DOMAIN}/?p=/tim-kiem`, changefreq: 'daily', priority: '0.9' },
    { loc: `${DOMAIN}/?p=/hoc-tap`, changefreq: 'daily', priority: '0.9' },
    { loc: `${DOMAIN}/?p=/vien`, changefreq: 'weekly', priority: '0.9' },
    { loc: `${DOMAIN}/?p=/cong-dong`, changefreq: 'daily', priority: '0.8' },
    { loc: `${DOMAIN}/?p=/bang-xep-hang`, changefreq: 'daily', priority: '0.8' },
    { loc: `${DOMAIN}/?p=/tro-ly`, changefreq: 'weekly', priority: '0.8' },
    { loc: `${DOMAIN}/?p=/tai-len`, changefreq: 'weekly', priority: '0.8' },
    { loc: `${DOMAIN}/?p=/extension`, changefreq: 'monthly', priority: '0.7' },
    { loc: `${DOMAIN}/?p=/lich`, changefreq: 'weekly', priority: '0.7' },
    { loc: `${DOMAIN}/?p=/xep-lich`, changefreq: 'weekly', priority: '0.7' },
    { loc: `${DOMAIN}/?p=/on-tap`, changefreq: 'weekly', priority: '0.8' },
    { loc: `${DOMAIN}/?p=/flashcard`, changefreq: 'weekly', priority: '0.7' },
    { loc: `${DOMAIN}/?p=/hoc-chung`, changefreq: 'daily', priority: '0.7' },
    { loc: `${DOMAIN}/?p=/hoi-dap`, changefreq: 'daily', priority: '0.8' },
    { loc: `${DOMAIN}/?p=/khong-gian`, changefreq: 'weekly', priority: '0.7' },
    { loc: `${DOMAIN}/?p=/thong-bao-truong`, changefreq: 'daily', priority: '0.8' },
    { loc: `${DOMAIN}/?p=/vinh-danh`, changefreq: 'weekly', priority: '0.7' },
    { loc: `${DOMAIN}/?p=/dieu-khoan`, changefreq: 'monthly', priority: '0.5' },
    { loc: `${DOMAIN}/?p=/quyen-rieng-tu`, changefreq: 'monthly', priority: '0.5' },
    { loc: `${DOMAIN}/?p=/minh-bach-ai`, changefreq: 'monthly', priority: '0.5' },
    { loc: `${DOMAIN}/?p=/go-tai-lieu`, changefreq: 'monthly', priority: '0.5' },
    { loc: `${DOMAIN}/?p=/minh-bach`, changefreq: 'monthly', priority: '0.5' },
    { loc: `${DOMAIN}/?p=/cong-tac-vien`, changefreq: 'monthly', priority: '0.6' }
  ];

  const facultyPages = faculties.map(f => ({
    loc: `${DOMAIN}/?p=/vien/${f.slug}`,
    changefreq: 'weekly',
    priority: '0.8'
  }));

  const coursePages = courses.map(c => ({
    loc: `${DOMAIN}/?p=/hoc-phan/${encodeURIComponent(c.code)}`,
    changefreq: 'weekly',
    priority: '0.8'
  }));

  const docPages = docs.map(d => {
    let lastmod = today;
    if (d.updatedAt || d.publishedAt) {
      try {
        lastmod = new Date(d.updatedAt || d.publishedAt).toISOString().split('T')[0];
      } catch {}
    }
    return {
      loc: `${DOMAIN}/?p=/tai-lieu/${encodeURIComponent(d.slug)}`,
      lastmod,
      changefreq: 'weekly',
      priority: '0.8'
    };
  });

  const allEntries = [...staticPages, ...facultyPages, ...coursePages, ...docPages];

  console.log(`Total URLs in sitemap: ${allEntries.length}`);

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

  for (const item of allEntries) {
    xml += `  <url>\n`;
    xml += `    <loc>${item.loc.replace(/&/g, '&amp;')}</loc>\n`;
    xml += `    <lastmod>${item.lastmod || today}</lastmod>\n`;
    xml += `    <changefreq>${item.changefreq || 'weekly'}</changefreq>\n`;
    xml += `    <priority>${item.priority || '0.7'}</priority>\n`;
    xml += `  </url>\n`;
  }

  xml += `</urlset>\n`;

  const sitemapPath = path.join(ROOT_DIR, 'sitemap.xml');
  fs.writeFileSync(sitemapPath, xml, 'utf8');
  console.log(`Wrote sitemap.xml (${xml.length} bytes) to ${sitemapPath}`);
}

generate().catch(console.error);
