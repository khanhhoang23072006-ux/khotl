import { readFile } from "node:fs/promises";
import sharp from "sharp";

export interface ProcessedImage {
  /** Ảnh gốc mã hóa lại: đã xoay đúng chiều và bỏ EXIF (có thể chứa vị trí GPS) */
  sanitized: Buffer;
  contentType: string;
  preview: Buffer;
  thumbnail: Buffer;
  width: number;
  height: number;
}

export async function processImage(filePath: string): Promise<ProcessedImage> {
  const input = await readFile(filePath);
  const metadata = await sharp(input).metadata();
  if (!metadata.width || !metadata.height) throw new Error("Không đọc được ảnh");

  // sharp mặc định không chép metadata sang ảnh đầu ra, nên EXIF bị loại bỏ.
  const rotated = sharp(input).rotate();
  const format = metadata.format === "png" ? "png" : metadata.format === "webp" ? "webp" : "jpeg";
  const sanitized =
    format === "png"
      ? await rotated.png().toBuffer()
      : format === "webp"
        ? await rotated.webp({ quality: 90 }).toBuffer()
        : await rotated.jpeg({ quality: 90 }).toBuffer();

  const preview = await sharp(input)
    .rotate()
    .resize({ width: 1000, withoutEnlargement: true })
    .webp({ quality: 78 })
    .toBuffer();
  const thumbnail = await sharp(input)
    .rotate()
    .resize({ width: 360, withoutEnlargement: true })
    .webp({ quality: 75 })
    .toBuffer();

  return {
    sanitized,
    contentType: `image/${format}`,
    preview,
    thumbnail,
    width: metadata.width,
    height: metadata.height,
  };
}
