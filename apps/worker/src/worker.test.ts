import { mkdtemp, writeFile } from "node:fs/promises";
import net from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseClamdReply, scanFile } from "./clamav";
import { judgeZip, parseUnzipListing } from "./zip";

describe("parseClamdReply", () => {
  it("đọc kết quả sạch và nhiễm", () => {
    expect(parseClamdReply("stream: OK\0")).toEqual({ status: "clean" });
    expect(parseClamdReply("stream: Eicar-Test-Signature FOUND\0")).toEqual({
      status: "infected",
      signature: "Eicar-Test-Signature",
    });
    expect(parseClamdReply("INSTREAM size limit exceeded. ERROR\0").status).toBe("error");
    expect(parseClamdReply("").status).toBe("error");
  });
});

describe("scanFile", () => {
  it("gửi đúng giao thức INSTREAM tới clamd", async () => {
    const server = net.createServer((socket) => {
      // Mỗi kết nối một bộ đệm riêng
      const received: Buffer[] = [];
      socket.on("data", (chunk) => {
        received.push(chunk);
        const all = Buffer.concat(received);
        // Kết thúc khi gặp khối độ dài 0
        if (all.length >= 4 && all.subarray(all.length - 4).readUInt32BE(0) === 0) {
          const payload = all.subarray("zINSTREAM\0".length);
          const length = payload.readUInt32BE(0);
          const body = payload.subarray(4, 4 + length).toString();
          socket.end(body.includes("EICAR") ? "stream: Eicar-Test-Signature FOUND\0" : "stream: OK\0");
        }
      });
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    const { port } = server.address() as net.AddressInfo;

    const dir = await mkdtemp(join(tmpdir(), "clamav-test-"));
    const cleanFile = join(dir, "clean.txt");
    const dirtyFile = join(dir, "dirty.txt");
    await writeFile(cleanFile, "Đề thi giải tích");
    await writeFile(dirtyFile, "X5O!P%@AP EICAR test");

    try {
      expect(await scanFile(cleanFile, { host: "127.0.0.1", port })).toEqual({ status: "clean" });
      expect((await scanFile(dirtyFile, { host: "127.0.0.1", port })).status).toBe("infected");
    } finally {
      server.close();
    }
  });

  it("báo lỗi khi không kết nối được", async () => {
    const result = await scanFile("/khong-ton-tai", { host: "127.0.0.1", port: 1, timeoutMs: 2000 });
    expect(result.status).toBe("error");
  });
});

const listing = `Archive:  bai-tap.zip
  Length      Date    Time    Name
---------  ---------- -----   ----
        0  2025-01-01 10:00   src/
     2048  2025-01-01 10:00   src/main.c
     1024  2025-01-01 10:00   README.md
---------                     -------
     3072                     3 files
`;

describe("zip", () => {
  it("đọc danh sách file từ unzip -l", () => {
    const inspection = parseUnzipListing(listing);
    expect(inspection.fileCount).toBe(2);
    expect(inspection.totalUncompressed).toBe(3072);
    expect(inspection.entries[0]?.name).toBe("src/main.c");
  });

  it("chấp nhận ZIP bình thường", () => {
    expect(judgeZip(parseUnzipListing(listing), 1500).ok).toBe(true);
  });

  it("chặn tỉ lệ nén bất thường", () => {
    expect(judgeZip({ entries: [], fileCount: 1, totalUncompressed: 500_000_000 }, 1000).ok).toBe(
      false,
    );
  });

  it("chặn file chạy được", () => {
    const verdict = judgeZip(
      { entries: [{ name: "setup.exe", size: 10 }], fileCount: 1, totalUncompressed: 10 },
      10,
    );
    expect(verdict.ok).toBe(false);
    expect(verdict.executables).toEqual(["setup.exe"]);
  });
});
