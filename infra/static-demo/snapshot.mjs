// Chụp bản tĩnh của web đang chạy (dữ liệu mẫu) để đăng lên GitHub Pages.
// Trang tĩnh không có máy chủ: bỏ toàn bộ JavaScript, giữ HTML + CSS, ảnh xem trước tải sẵn.
// Chạy: SNAPSHOT_BASE=/khotl node infra/static-demo/snapshot.mjs  (web phải chạy ở localhost:3000)
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const ORIGIN = process.env.SNAPSHOT_ORIGIN ?? "http://localhost:3000";
const BASE = (process.env.SNAPSHOT_BASE ?? "").replace(/\/$/, "");
const OUT = process.env.SNAPSHOT_OUT ?? "static-demo";
const NEXT_DIR = process.env.SNAPSHOT_NEXT_DIR ?? "apps/web/.next";
const MAX_PAGES = 600;

const ALLOWED = /^\/$|^\/(vien|hoc-phan|tai-lieu|tim-kiem|dieu-khoan|quyen-rieng-tu|go-tai-lieu|dang-nhap)(\/|$)/;
const BANNER = `<div style="position:sticky;top:0;z-index:60;background:#B3172B;color:#fff;font:600 13px/1.4 system-ui,sans-serif;padding:8px 16px;text-align:center">Bản xem tĩnh với dữ liệu mẫu: xem được trang chủ, Viện, học phần, tài liệu. Đăng nhập, tìm kiếm theo từ khoá, tải lên và kiểm duyệt cần bản chạy thật (xem README).</div>`;

const seen = new Set();
const queue = ["/", "/vien", "/tim-kiem", "/dieu-khoan", "/quyen-rieng-tu", "/go-tai-lieu", "/dang-nhap"];
const images = new Set();

function outFile(pagePath) {
  const clean = pagePath === "/" ? "" : pagePath.replace(/^\//, "");
  return path.join(OUT, clean, "index.html");
}

function transform(html) {
  let result = html
    // Không có máy chủ nên bỏ JavaScript: trang vẫn đọc và bấm liên kết được như web thường
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<link\b[^>]*(?:as="script"|rel="modulepreload")[^>]*>/gi, "")
    // Ảnh xem trước lưu thành file .webp
    .replace(/(\/api\/tai-lieu\/[^/"?]+\/anh\/\d+)(?=")/g, "$1.webp")
    // Tải xuống cần đăng nhập
    .replace(/\/api\/tai-lieu\/[^"]+\/tai-xuong[^"]*/g, "/dang-nhap");
  if (BASE) {
    result = result
      .replace(/\b(href|src|action|srcSet|srcset)="\/(?!\/)/g, `$1="${BASE}/`)
      .replace(/url\(\/(?!\/)/g, `url(${BASE}/`);
  }
  return result.replace(/<body([^>]*)>/i, `<body$1>${BANNER}`);
}

async function savePage(pagePath) {
  const response = await fetch(`${ORIGIN}${pagePath}`, { redirect: "follow" });
  if (!response.ok || !(response.headers.get("content-type") ?? "").includes("text/html")) {
    console.log(`::warning::Bỏ qua ${pagePath}: HTTP ${response.status}`);
    return;
  }
  const html = await response.text();
  for (const match of html.matchAll(/href="(\/[^"#]*)"/g)) {
    const target = match[1].split("?")[0].replace(/\/$/, "") || "/";
    if (ALLOWED.test(target) && !seen.has(target)) {
      seen.add(target);
      queue.push(target);
    }
  }
  for (const match of html.matchAll(/(\/api\/tai-lieu\/[^/"?]+\/anh\/\d+)"/g)) images.add(match[1]);
  const file = outFile(pagePath);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, transform(html));
}

function fixCss(dir) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) fixCss(full);
    else if (name.endsWith(".css") && BASE) {
      writeFileSync(full, readFileSync(full, "utf8").replace(/url\(\/(?!\/)/g, `url(${BASE}/`));
    }
  }
}
async function main() {
  mkdirSync(OUT, { recursive: true });
  for (const start of queue) seen.add(start);
  let count = 0;
  while (queue.length > 0 && count < MAX_PAGES) {
    const next = queue.shift();
    await savePage(next);
    count++;
  }

  for (const image of images) {
    const response = await fetch(`${ORIGIN}${image}`, { redirect: "follow" });
    if (!response.ok) continue;
    const file = path.join(OUT, `${image.replace(/^\//, "")}.webp`);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, Buffer.from(await response.arrayBuffer()));
  }

  // Trang 404 và các file tĩnh dùng chung
  const notFound = await fetch(`${ORIGIN}/trang-khong-ton-tai`);
  writeFileSync(path.join(OUT, "404.html"), transform(await notFound.text()));
  for (const asset of ["/icon.svg", "/manifest.webmanifest"]) {
    const response = await fetch(`${ORIGIN}${asset}`);
    if (response.ok) writeFileSync(path.join(OUT, asset.slice(1)), Buffer.from(await response.arrayBuffer()));
  }

  // CSS, font: chép từ thư mục build và sửa đường dẫn tuyệt đối theo BASE
  const staticDir = path.join(NEXT_DIR, "static");
  cpSync(staticDir, path.join(OUT, "_next", "static"), { recursive: true });
  if (existsSync(path.join(OUT, "_next"))) fixCss(path.join(OUT, "_next"));
  writeFileSync(path.join(OUT, ".nojekyll"), "");
  console.log(`Đã lưu ${count} trang và ${images.size} ảnh xem trước vào ${OUT}`);
}

try {
  await main();
} catch (error) {
  console.log(`::error::Chụp trang tĩnh lỗi: ${String(error?.stack ?? error).replace(/\n/g, "%0A")}`);
  process.exit(1);
}
