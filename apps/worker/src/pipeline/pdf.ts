import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { run } from "../tools";

export interface PdfInfo {
  pages: number;
  encrypted: boolean;
}

/** Đọc số trang bằng pdfinfo; ném lỗi nếu file hỏng hoặc cần mật khẩu để mở. */
export async function pdfInfo(filePath: string): Promise<PdfInfo> {
  const { stdout } = await run("pdfinfo", [filePath], { timeoutMs: 30_000 });
  const pages = Number(/^Pages:\s+(\d+)/m.exec(stdout)?.[1] ?? Number.NaN);
  if (!Number.isFinite(pages) || pages <= 0) {
    throw new Error("Không đọc được số trang");
  }
  return { pages, encrypted: /^Encrypted:\s+yes/m.test(stdout) };
}

/** Trích văn bản bằng pdftotext (giữ dấu tiếng Việt), cắt ở 1 triệu ký tự. */
export async function pdfText(filePath: string): Promise<string> {
  const { stdout } = await run("pdftotext", ["-enc", "UTF-8", "-q", filePath, "-"], {
    timeoutMs: 120_000,
    maxBuffer: 64 * 1024 * 1024,
  });
  return stdout.replace(/\f/g, "\n").slice(0, 1_000_000);
}

export interface RenderedPages {
  /** Ảnh WebP các trang đầu (dành cho khách) */
  pages: Buffer[];
  /** Ảnh bìa nhỏ cho danh sách */
  thumbnail: Buffer;
}

/**
 * Vẽ các trang đầu thành ảnh: pdftoppm → PNG → sharp → WebP.
 * pdftoppm đặt tên file theo số trang có thêm số 0 ở đầu tùy tổng số trang, nên đọc thư mục rồi sắp xếp.
 */
export async function renderPages(filePath: string, workDir: string, count: number): Promise<RenderedPages> {
  const prefix = join(workDir, "page");
  await run(
    "pdftoppm",
    ["-png", "-scale-to", "1400", "-f", "1", "-l", String(count), filePath, prefix],
    { timeoutMs: 120_000 },
  );
  const files = (await readdir(workDir))
    .filter((name) => name.startsWith("page") && name.endsWith(".png"))
    .sort((a, b) => pageNumber(a) - pageNumber(b));
  if (files.length === 0) throw new Error("Không vẽ được trang nào");

  const pages: Buffer[] = [];
  for (const name of files) {
    const png = await readFile(join(workDir, name));
    pages.push(
      await sharp(png).resize({ width: 1000, withoutEnlargement: true }).webp({ quality: 78 }).toBuffer(),
    );
  }
  const firstPng = await readFile(join(workDir, files[0] as string));
  const thumbnail = await sharp(firstPng)
    .resize({ width: 360, withoutEnlargement: true })
    .webp({ quality: 75 })
    .toBuffer();
  return { pages, thumbnail };
}

function pageNumber(fileName: string): number {
  return Number(/-(\d+)\.png$/.exec(fileName)?.[1] ?? 0);
}
