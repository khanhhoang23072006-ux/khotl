import { access } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { run } from "../tools";

/**
 * Chuyển DOCX/PPTX/XLSX sang PDF bằng LibreOffice headless.
 * Mỗi lần chạy dùng hồ sơ LibreOffice riêng trong thư mục tạm để các job song song không khóa nhau.
 */
export async function convertOfficeToPdf(inputPath: string, workDir: string): Promise<string> {
  const profileDir = pathToFileURL(join(workDir, "lo-profile")).toString();
  await run(
    "soffice",
    [
      `-env:UserInstallation=${profileDir}`,
      "--headless",
      "--norestore",
      "--convert-to",
      "pdf",
      "--outdir",
      workDir,
      inputPath,
    ],
    { timeoutMs: 180_000, env: { ...process.env, HOME: workDir } },
  );
  const output = join(workDir, `${basename(inputPath, extname(inputPath))}.pdf`);
  await access(output);
  return output;
}
