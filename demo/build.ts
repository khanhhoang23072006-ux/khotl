// Dựng bản demo một file HTML: lấy danh mục mẫu ở packages/db/prisma/seed-data.ts,
// sinh tài liệu mẫu (cùng cách với seed), nhúng thẳng vào demo/index.html.
// Chạy: pnpm demo:build   (hoặc: npx tsx demo/build.ts)
import { readFileSync, writeFileSync } from "node:fs";
import {
  COURSES,
  COURSES_WITH_DOCUMENTS,
  DEFAULT_BANNED_WORDS,
  DOCUMENT_TEMPLATES,
  FACULTIES,
} from "../packages/db/prisma/seed-data";

function createRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}
const random = createRandom(20251);
const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)] as T;

function slugify(input: string): string {
  return (
    input
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 70) || "tai-lieu"
  );
}

const terms = ["20231", "20232", "20241", "20242", "20251"];
const uploaders = ["Sinh viên Demo", "Lê Minh Quân", "Nguyễn Thu Hà", "Trần Đức Anh", "Phạm Ngọc Mai"];
const now = new Date("2026-10-24T08:00:00+07:00").getTime();

const documents = [];
let id = 1;
for (const code of COURSES_WITH_DOCUMENTS) {
  const course = COURSES.find((c) => c.code === code);
  if (!course) continue;
  const templates = [...DOCUMENT_TEMPLATES].sort(() => random() - 0.5).slice(0, 2 + Math.floor(random() * 3));
  for (const [index, template] of templates.entries()) {
    const term = pick(terms);
    const title = template.title(course.name, term, index + 1);
    const pages = 3 + Math.floor(random() * 3);
    const downloads = Math.floor(random() * 2500);
    const ratingCount = Math.floor(random() * 60);
    const ratingSum = Math.round(ratingCount * (3.4 + random() * 1.5));
    const publishedAt = now - Math.floor(random() * 120) * 86_400_000;
    documents.push({
      id: `d${id}`,
      slug: `${slugify(title)}-${(id * 7919).toString(36)}`,
      title,
      description: template.description,
      type: template.type,
      status: "APPROVED",
      course: course.code,
      term,
      pages,
      sizeKb: 180 + Math.floor(random() * 2400),
      kind: "PDF",
      downloads,
      views: downloads * 3 + Math.floor(random() * 200),
      ratingCount,
      ratingSum,
      publishedAt,
      createdAt: publishedAt,
      uploader: id % 3 === 0 ? pick(uploaders) : "Sinh viên Demo",
      anonymous: random() < 0.15,
      tags: [...course.keywords.slice(0, 2), ...(template.type === "EXAM_FINAL" ? ["đáp án"] : [])],
    });
    id++;
  }
}

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
  generatedAt: new Date().toISOString(),
};

const template = readFileSync(new URL("./template.html", import.meta.url), "utf8");
const html = template.replace("/*__DATA__*/null", JSON.stringify(data).replace(/</g, "\\u003c"));
writeFileSync(new URL("./index.html", import.meta.url), html);
// Bản ở gốc repo để GitHub Pages (chế độ "Deploy from branch: main") mở thẳng bản demo
writeFileSync(new URL("../index.html", import.meta.url), html);
console.log(`demo/index.html: ${data.faculties.length} Viện, ${data.courses.length} học phần, ${documents.length} tài liệu`);
