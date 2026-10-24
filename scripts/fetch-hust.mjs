// Lấy thông báo công khai trên ctt.hust.edu.vn, gắn nhãn (CTĐT, đề cương, đăng ký học tập, lịch thi...)
// và ghi vào data/hust-feed.json để trang web hiển thị. Chạy mỗi ngày bằng GitHub Actions.
// Chỉ đọc các trang danh sách công khai, mỗi lần chạy vài yêu cầu, cách nhau 1,5 giây.
// Chạy tay: node scripts/fetch-hust.mjs
import { readFile, writeFile } from "node:fs/promises";

const BASE = "https://ctt.hust.edu.vn";
const SOURCES = [
  { path: "/", source: "Trang chủ" },
  { path: "/DisplayWeb/DisplayListBaiViet?tag=ĐTĐH", source: "Thông báo đại học" },
  { path: "/DisplayWeb/DisplayListBaiViet?tag=ĐTĐH&page=2", source: "Thông báo đại học" },
  { path: "/DisplayWeb/DisplayQuyChe?tag=ĐTĐH", source: "Quy định đại học" },
];
const OUT = new URL("../data/hust-feed.json", import.meta.url);
const USER_AGENT = "HUSTDOCU-feed/1.0 (+https://github.com/khanhhoang23072006-ux/khotl)";
const MAX_ITEMS = 300;

/** Nhãn theo từ khóa trong tiêu đề (so khớp không dấu). */
const TAGS = [
  ["ctdt", /chuong trinh dao tao|ctdt|khung chuong trinh|chuan dau ra/],
  ["decuong", /de cuong|syllabus/],
  ["dangky", /dang ky (hoc tap|lop|ke hoach|hoc phan)|ke hoach hoc tap|dang ky tot nghiep/],
  ["lichthi", /lich thi|thi cuoi ky|thi giua ky|kiem tra tieng anh|ky thi/],
  ["hocphi", /hoc phi/],
  ["hocbong", /hoc bong|khen thuong/],
  ["quyche", /quy che|quy dinh|huong dan|regulation/],
];

export function plain(text) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

function decodeEntities(text) {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(Number.parseInt(n, 16)));
}

function toIsoDate(raw) {
  const m = raw.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
  if (!m) return null;
  const [, d, mo, y] = m;
  const day = Number(d);
  const month = Number(mo);
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;
  return `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Ngày gần liên kết nhất (trong 400 ký tự trước hoặc sau), tránh lấy nhầm ngày của mục bên cạnh. */
function nearestDate(html, start, end) {
  const strip = (text) => decodeEntities(text.replace(/<[^>]+>/g, " "));
  const before = strip(html.slice(Math.max(0, start - 400), start));
  const after = strip(html.slice(end, end + 400));
  const re = /\d{1,2}[./-]\d{1,2}[./-]\d{4}/g;
  const lastBefore = [...before.matchAll(re)].pop();
  const firstAfter = after.match(re);
  const distBefore = lastBefore ? before.length - lastBefore.index : Number.POSITIVE_INFINITY;
  const distAfter = firstAfter ? firstAfter.index : Number.POSITIVE_INFINITY;
  if (distBefore === Number.POSITIVE_INFINITY && distAfter === Number.POSITIVE_INFINITY) return null;
  return toIsoDate(distBefore <= distAfter ? lastBefore[0] : firstAfter[0]);
}

/** Trích các liên kết tới bài viết/kế hoạch cùng tiêu đề và ngày (nếu có) ở gần đó. */
export function parseList(html, source) {
  const items = new Map();
  const re = /<a\b[^>]*href="([^"]*Display(?:BaiViet|Kehoach)\?[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(re)) {
    const href = decodeEntities(match[1]);
    const url = new URL(href, BASE).toString();
    const title = decodeEntities(match[2].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
    if (title.length < 8) continue;
    const date = toIsoDate(title) ?? nearestDate(html, match.index, match.index + match[0].length);
    const prev = items.get(url);
    if (!prev || title.length > prev.title.length) items.set(url, { url, title, date, source });
  }
  return [...items.values()];
}

export function tagsFor(title) {
  const t = plain(title);
  return TAGS.filter(([, re]) => re.test(t)).map(([tag]) => tag);
}

async function fetchPage(path) {
  const res = await fetch(new URL(path, BASE), {
    headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.text();
}

async function main() {
  let previous = { items: [] };
  try {
    previous = JSON.parse(await readFile(OUT, "utf8"));
  } catch {
    // chưa có file: lần chạy đầu tiên
  }
  const known = new Map(previous.items.map((item) => [item.url, item]));
  const now = new Date().toISOString();
  const errors = [];
  let found = 0;
  for (const { path, source } of SOURCES) {
    try {
      const items = parseList(await fetchPage(path), source);
      found += items.length;
      for (const item of items) {
        const old = known.get(item.url);
        known.set(item.url, {
          ...item,
          date: item.date ?? old?.date ?? null,
          tags: tagsFor(item.title),
          firstSeen: old?.firstSeen ?? now,
        });
      }
    } catch (error) {
      errors.push(String(error.message ?? error));
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  if (found === 0) {
    console.error("Không lấy được mục nào, giữ nguyên dữ liệu cũ.", errors);
    process.exitCode = 1;
    return;
  }
  const items = [...known.values()]
    .sort((a, b) => (b.date ?? b.firstSeen).localeCompare(a.date ?? a.firstSeen))
    .slice(0, MAX_ITEMS);
  const changed = JSON.stringify(items) !== JSON.stringify(previous.items);
  if (!changed) {
    console.log(`Không có gì mới (${items.length} mục).`);
    return;
  }
  await writeFile(
    OUT,
    `${JSON.stringify({ source: BASE, fetchedAt: now, errors, items }, null, 1)}\n`,
  );
  console.log(`Đã ghi ${items.length} mục, ${errors.length} lỗi.`);
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
