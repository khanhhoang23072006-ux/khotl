import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const FTP_HOST = 'free02.123host.vn';
const FTP_USER = 'avkierzi';
const FTP_PASS = 'AfOUU4JStl';
const FTP_DIR = '/domains/hustdocu.id.vn/public_html';
const FTP_BASE = `ftp://${FTP_HOST}${FTP_DIR}`;

const filesToUpload = [
  '.htaccess',
  'index.html',
  'sw.js',
  'manifest.webmanifest',
  'api/_security.php',
  'api/_mailer.php',
  'api/send_otp.php',
  'api/verify_otp.php',
  'api/voice_signal.php',
  'api/extensions.php',
  'api/docs.php',
  'api/sync.php',
  'api/config.php',
  'api/data/.htaccess',
  'api/data/otps/.htaccess',
  'api/data/docs/.htaccess',
  'data/hust-feed.json',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/og.png'
];

async function upload() {
  console.log(`=== Uploading to ${FTP_BASE} ===`);
  let successCount = 0;
  let failCount = 0;

  for (const rel of filesToUpload) {
    const local = path.resolve('C:\\Users\\Asus\\.gemini\\antigravity-ide\\scratch\\khotl', rel);
    if (!fs.existsSync(local)) {
      console.warn(`[SKIP] Missing local file: ${rel}`);
      continue;
    }

    const targetUrl = `${FTP_BASE}/${rel.replace(/\\/g, '/')}`;
    console.log(`Uploading ${rel}...`);

    try {
      execSync(`curl.exe -k -s -S --fail --ftp-create-dirs --user "${FTP_USER}:${FTP_PASS}" -T "${local}" "${targetUrl}"`, {
        timeout: 30000,
        stdio: 'pipe'
      });
      console.log(`  -> OK: ${rel}`);
      successCount++;
    } catch (e) {
      console.error(`  -> FAIL: ${rel}`, e.message);
      failCount++;
    }
  }

  console.log(`=== Upload finished: ${successCount} succeeded, ${failCount} failed ===`);
  if (failCount > 0) process.exit(1);
}

upload().catch(err => {
  console.error('Upload crashed:', err);
  process.exit(1);
});
