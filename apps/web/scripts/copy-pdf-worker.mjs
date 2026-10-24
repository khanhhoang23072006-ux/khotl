// Chép worker của pdf.js vào public/ để trình duyệt tải cùng origin (CSP worker-src 'self').
// Chạy tự động trước `next dev` và `next build`.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const pkgDir = path.dirname(require.resolve("pdfjs-dist/package.json"));
mkdirSync("public", { recursive: true });
copyFileSync(path.join(pkgDir, "build", "pdf.worker.min.mjs"), path.join("public", "pdf.worker.min.mjs"));
console.log("Đã chép pdf.worker.min.mjs vào public/");
