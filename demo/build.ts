// Dựng bản demo một file HTML: lấy danh mục mẫu ở packages/db/prisma/seed-data.ts,
// nhúng thẳng vào demo/index.html (không có tài liệu mẫu).
// Chạy: pnpm demo:build   (hoặc: npx tsx demo/build.ts)
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import {
  COURSES,
  DEFAULT_BANNED_WORDS,
  FACULTIES,
} from "../packages/db/prisma/seed-data";

// Không có tài liệu mẫu: kho bắt đầu trống, tài liệu đến từ sinh viên tải lên.
const documents: never[] = [];

const data = {
  faculties: FACULTIES.map((f, index) => ({ ...f, slug: f.code.toLowerCase(), order: index })),
  courses: COURSES.map((c) => ({
    ...c,
    grading: [
      { label: "Quá trình", weight: c.credits >= 3 ? 0.4 : 0.3 },
      { label: "Cuối kỳ", weight: c.credits >= 3 ? 0.6 : 0.7 },
    ],
  })),
  documents,
  bannedWords: DEFAULT_BANNED_WORDS,
  // Bản chụp thông báo HUST lúc dựng, dùng khi không tải được data/hust-feed.json (mở file trực tiếp)
  hustFeed: existsSync(new URL("../data/hust-feed.json", import.meta.url))
    ? JSON.parse(readFileSync(new URL("../data/hust-feed.json", import.meta.url), "utf8"))
    : null,
  generatedAt: new Date().toISOString(),
};

const template = readFileSync(new URL("./template.html", import.meta.url), "utf8");
// Giai đoạn 6 trở đi viết ở file riêng cho dễ đọc, nhúng vào cùng một thẻ <script>
const study = readFileSync(new URL("./study.js", import.meta.url), "utf8");
const community = readFileSync(new URL("./community.js", import.meta.url), "utf8");
const moderation = readFileSync(new URL("./moderation.js", import.meta.url), "utf8");
const html = template
  .replace("/*__DATA__*/null", JSON.stringify(data).replace(/</g, "\\u003c"))
  .replace("/*__STUDY__*/", () => study.replace(/<\/script/gi, "<\\/script"))
  .replace("/*__COMMUNITY__*/", () => community.replace(/<\/script/gi, "<\\/script"))
  .replace("/*__MODERATION__*/", () => moderation.replace(/<\/script/gi, "<\\/script"));
writeFileSync(new URL("./index.html", import.meta.url), html);
// Bản ở gốc repo để GitHub Pages (chế độ "Deploy from branch: main") mở thẳng bản demo
writeFileSync(new URL("../index.html", import.meta.url), html);
console.log(`demo/index.html: ${data.faculties.length} Viện, ${data.courses.length} học phần, ${documents.length} tài liệu`);
