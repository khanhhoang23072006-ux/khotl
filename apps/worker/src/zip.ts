export interface ZipEntry {
  name: string;
  size: number;
}

export interface ZipInspection {
  entries: ZipEntry[];
  totalUncompressed: number;
  fileCount: number;
}

export interface ZipVerdict {
  ok: boolean;
  reason?: string;
  nestedArchives: number;
  executables: string[];
}

const EXECUTABLE_PATTERN = /\.(exe|bat|cmd|com|scr|msi|ps1|vbs|js|jar|apk|sh|dll)$/i;
const ARCHIVE_PATTERN = /\.(zip|rar|7z|tar|gz|tgz)$/i;

/** Đọc kết quả `unzip -l`: các dòng giữa hai đường gạch là "độ dài  ngày  giờ  tên". */
export function parseUnzipListing(output: string): ZipInspection {
  const lines = output.split(/\r?\n/);
  const entries: ZipEntry[] = [];
  let inTable = false;
  for (const line of lines) {
    if (/^-{5,}/.test(line.trim())) {
      if (inTable) break;
      inTable = true;
      continue;
    }
    if (!inTable) continue;
    const match = /^\s*(\d+)\s+\S+\s+\S+\s+(.+)$/.exec(line);
    if (match?.[1] && match[2]) {
      entries.push({ size: Number(match[1]), name: match[2].trim() });
    }
  }
  const files = entries.filter((entry) => !entry.name.endsWith("/"));
  return {
    entries: files,
    totalUncompressed: files.reduce((sum, entry) => sum + entry.size, 0),
    fileCount: files.length,
  };
}

/** Chặn zip bomb (tỉ lệ nén bất thường, quá nhiều file) và file chạy được bên trong. */
export function judgeZip(inspection: ZipInspection, compressedSize: number): ZipVerdict {
  const executables = inspection.entries
    .map((entry) => entry.name)
    .filter((name) => EXECUTABLE_PATTERN.test(name));
  const nestedArchives = inspection.entries.filter((entry) => ARCHIVE_PATTERN.test(entry.name)).length;

  if (inspection.fileCount > 2000) {
    return { ok: false, reason: "ZIP có quá nhiều file (trên 2.000)", nestedArchives, executables };
  }
  if (inspection.totalUncompressed > 1024 * 1024 * 1024) {
    return { ok: false, reason: "ZIP giải nén ra quá 1 GB", nestedArchives, executables };
  }
  if (compressedSize > 0 && inspection.totalUncompressed / compressedSize > 100) {
    return { ok: false, reason: "Tỉ lệ nén bất thường, nghi zip bomb", nestedArchives, executables };
  }
  if (nestedArchives > 3) {
    return { ok: false, reason: "ZIP chứa quá nhiều file nén lồng nhau", nestedArchives, executables };
  }
  if (executables.length > 0) {
    return {
      ok: false,
      reason: `ZIP chứa file chạy được: ${executables.slice(0, 3).join(", ")}`,
      nestedArchives,
      executables,
    };
  }
  return { ok: true, nestedArchives, executables };
}
