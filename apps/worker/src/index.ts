import { getStorage } from "@khotl/adapters";
import { prisma } from "@khotl/db";
import { sendPendingEmails } from "./email";
import { config } from "./env";
import { errorMessage, log } from "./log";
import { type PipelineContext, processVersion } from "./pipeline/process-version";
import { detectTools } from "./tools";

let stopping = false;

interface Claim {
  id: string;
  documentId: string;
  attempts: number;
}

/**
 * Bảng document_versions chính là hàng đợi (outbox): web ghi bản ghi QUEUED trong cùng
 * transaction tạo tài liệu, worker nhận việc bằng FOR UPDATE SKIP LOCKED.
 * Job bị kẹt quá 15 phút (worker chết giữa chừng) được nhận lại; lỗi tạm thời thử lại sau 1 phút.
 */
async function claimNextVersion(): Promise<Claim | null> {
  const rows = await prisma.$queryRaw<Claim[]>`
    UPDATE document_versions
    SET "processingStatus" = 'RUNNING', "lockedAt" = now(), attempts = attempts + 1
    WHERE id = (
      SELECT id FROM document_versions
      WHERE ("processingStatus" = 'QUEUED' AND ("lockedAt" IS NULL OR "lockedAt" < now() - interval '1 minute'))
         OR ("processingStatus" = 'RUNNING' AND "lockedAt" < now() - interval '15 minutes')
      ORDER BY "createdAt"
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING id, "documentId", attempts`;
  return rows[0] ?? null;
}

async function processNext(ctx: PipelineContext): Promise<boolean> {
  const claim = await claimNextVersion();
  if (!claim) return false;
  const startedAt = Date.now();
  try {
    await processVersion(claim.id, ctx);
    log.info("Đã xử lý tài liệu", { versionId: claim.id, ms: Date.now() - startedAt });
  } catch (error) {
    const message = errorMessage(error);
    if (claim.attempts >= config.maxAttempts) {
      // Hết lượt thử: đưa cho kiểm duyệt viên quyết định thay vì treo mãi.
      log.error("Xử lý thất bại, chuyển sang kiểm duyệt thủ công", { versionId: claim.id, error: message });
      await prisma.documentVersion.update({
        where: { id: claim.id },
        data: { processingStatus: "FAILED", lockedAt: null, processingError: message },
      });
      await prisma.document.updateMany({
        where: { id: claim.documentId, status: "PROCESSING" },
        data: { status: "PENDING_REVIEW", riskScore: 50 },
      });
    } else {
      log.warn("Xử lý lỗi, sẽ thử lại", { versionId: claim.id, attempt: claim.attempts, error: message });
      await prisma.documentVersion.update({
        where: { id: claim.id },
        data: { processingStatus: "QUEUED", lockedAt: new Date(), processingError: message },
      });
    }
  }
  return true;
}

async function loadBannedWords(): Promise<string[]> {
  const setting = await prisma.systemSetting.findUnique({ where: { key: "moderation.bannedWords" } });
  return Array.isArray(setting?.value) ? setting.value.filter((v): v is string => typeof v === "string") : [];
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Lặp một việc: có việc thì làm tiếp ngay, không có thì nghỉ `idleMs`. */
async function loop(name: string, idleMs: number, task: () => Promise<boolean>) {
  while (!stopping) {
    try {
      const didWork = await task();
      if (!didWork) await sleep(idleMs);
    } catch (error) {
      log.error(`Vòng lặp ${name} lỗi`, { error: errorMessage(error) });
      await sleep(idleMs * 2);
    }
  }
}

async function main() {
  const tools = await detectTools();
  log.info("Worker khởi động", { tools, concurrency: config.concurrency, clamav: Boolean(config.clamav) });
  if (!tools.poppler) log.warn("Thiếu poppler-utils: sẽ không có ảnh xem trước và văn bản để tìm kiếm");
  if (!tools.libreoffice) log.warn("Thiếu LibreOffice: DOCX/PPTX/XLSX sẽ không xem trước được");

  const bucket = await getStorage().ensureBucket([config.appUrl]);
  if (bucket.created) log.info("Đã tạo bucket lưu file");
  if (bucket.corsError) log.warn("Không đặt được CORS cho bucket", { error: bucket.corsError });

  const ctx: PipelineContext = { tools, bannedWords: await loadBannedWords() };
  const refreshSettings = setInterval(async () => {
    try {
      ctx.bannedWords = await loadBannedWords();
    } catch (error) {
      log.warn("Không tải lại được cấu hình", { error: errorMessage(error) });
    }
  }, 5 * 60_000);

  const shutdown = () => {
    if (stopping) return;
    stopping = true;
    clearInterval(refreshSettings);
    log.info("Đang dừng worker sau khi xong việc hiện tại");
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await Promise.all([
    ...Array.from({ length: config.concurrency }, (_, i) =>
      loop(`tai-lieu-${i + 1}`, 2000, () => processNext(ctx)),
    ),
    loop("email", 5000, sendPendingEmails),
  ]);
  await prisma.$disconnect();
  log.info("Worker đã dừng");
}

main().catch((error) => {
  log.error("Worker dừng vì lỗi", { error: errorMessage(error) });
  process.exit(1);
});
