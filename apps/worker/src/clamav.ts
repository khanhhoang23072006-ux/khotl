import { createReadStream } from "node:fs";
import net from "node:net";

export type ScanResult =
  | { status: "clean" }
  | { status: "infected"; signature: string }
  | { status: "error"; message: string };

/**
 * Quét file bằng clamd qua lệnh INSTREAM:
 * gửi "zINSTREAM\0", rồi từng khối [độ dài 4 byte big-endian][dữ liệu], kết thúc bằng 4 byte 0.
 * clamd trả "stream: OK" hoặc "stream: <tên mã độc> FOUND".
 */
export function scanFile(
  filePath: string,
  options: { host: string; port: number; timeoutMs?: number },
): Promise<ScanResult> {
  return new Promise((resolve) => {
    let settled = false;
    let reply = "";
    const finish = (result: ScanResult) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(result);
    };

    const socket = net.createConnection({ host: options.host, port: options.port });
    socket.setTimeout(options.timeoutMs ?? 120_000);
    socket.on("timeout", () => finish({ status: "error", message: "Hết thời gian chờ ClamAV" }));
    socket.on("error", (error) => finish({ status: "error", message: error.message }));
    socket.on("data", (chunk) => {
      reply += chunk.toString("utf8");
      if (reply.includes("\0") || reply.includes("\n")) finish(parseClamdReply(reply));
    });
    socket.on("end", () => finish(parseClamdReply(reply)));

    socket.on("connect", () => {
      socket.write("zINSTREAM\0");
      const stream = createReadStream(filePath, { highWaterMark: 64 * 1024 });
      stream.on("data", (data) => {
        const buffer = typeof data === "string" ? Buffer.from(data) : data;
        const size = Buffer.alloc(4);
        size.writeUInt32BE(buffer.length, 0);
        const flushed = socket.write(Buffer.concat([size, buffer]));
        if (!flushed) {
          stream.pause();
          socket.once("drain", () => stream.resume());
        }
      });
      stream.on("end", () => socket.write(Buffer.alloc(4)));
      stream.on("error", (error) => finish({ status: "error", message: error.message }));
    });
  });
}

export function parseClamdReply(raw: string): ScanResult {
  const reply = raw.replace(/\0/g, "").trim();
  if (reply === "") return { status: "error", message: "ClamAV không trả lời" };
  if (/:\s*OK$/.test(reply)) return { status: "clean" };
  const found = /:\s*(.+)\s+FOUND$/.exec(reply);
  if (found?.[1]) return { status: "infected", signature: found[1] };
  return { status: "error", message: reply };
}
