import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface RunResult {
  stdout: string;
  stderr: string;
}

/** Chạy chương trình ngoài với giới hạn thời gian; ném lỗi kèm stderr nếu thất bại. */
export async function run(
  command: string,
  args: string[],
  options: { timeoutMs?: number; env?: NodeJS.ProcessEnv; maxBuffer?: number } = {},
): Promise<RunResult> {
  const result = await execFileAsync(command, args, {
    timeout: options.timeoutMs ?? 60_000,
    maxBuffer: options.maxBuffer ?? 20 * 1024 * 1024,
    env: options.env ?? process.env,
    encoding: "utf8",
  });
  return { stdout: result.stdout, stderr: result.stderr };
}

export interface ToolAvailability {
  poppler: boolean;
  libreoffice: boolean;
  unzip: boolean;
}

async function has(command: string, args: string[]): Promise<boolean> {
  try {
    await run(command, args, { timeoutMs: 15_000 });
    return true;
  } catch (error) {
    // pdftoppm -v in phiên bản ra stderr và có thể trả mã khác 0 ở bản cũ
    const code = (error as { code?: unknown }).code;
    return typeof code === "number";
  }
}

/** Kiểm tra công cụ có sẵn; thiếu công cụ thì worker vẫn chạy nhưng bỏ bước tương ứng. */
export async function detectTools(): Promise<ToolAvailability> {
  const [poppler, libreoffice, unzip] = await Promise.all([
    has("pdftoppm", ["-v"]),
    has("soffice", ["--version"]),
    has("unzip", ["-v"]),
  ]);
  return { poppler, libreoffice, unzip };
}
