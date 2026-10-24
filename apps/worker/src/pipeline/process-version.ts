import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getStorage } from "@khotl/adapters";
import {
  isStaff,
  isTooShort,
  type RoleName,
  NEAR_DUPLICATE_MAX_DISTANCE,
  simhash,
  assessContentRisk,
  detectedTypeMatches,
  type FileKindKey,
  fileExtension,
  maxUploadBytes,
  queuePriority,
  suggestTags,
} from "@khotl/core";
import { type Prisma, prisma } from "@khotl/db";
import { fileTypeFromFile } from "file-type";
import { scanFile } from "../clamav";
import { config } from "../env";
import { run, type ToolAvailability } from "../tools";
import { judgeZip, parseUnzipListing } from "../zip";
import { processImage } from "./image";
import { convertOfficeToPdf } from "./office";
import { pdfInfo, pdfText, renderPages } from "./pdf";

type CheckStatus = "pass" | "fail" | "warn" | "skipped";

interface CheckEntry {
  status: CheckStatus;
  detail?: string;
  [key: string]: unknown;
}

/** Kết quả từng bước, lưu vào DocumentVersion.checkResults để kiểm duyệt viên xem. */
type Checks = Record<string, CheckEntry>;

export interface PipelineContext {
  tools: ToolAvailability;
  bannedWords: string[];
}

/** Lỗi tạm thời (mất kết nối ClamAV, kho lưu trữ...): job sẽ được thử lại. */
export class TransientError extends Error {}

const CACHE_IMMUTABLE = "public, max-age=31536000, immutable";

type VersionWithDocument = NonNullable<Awaited<ReturnType<typeof loadVersion>>>;

function loadVersion(versionId: string) {
  return prisma.documentVersion.findUnique({
    where: { id: versionId },
    include: {
      document: {
        select: {
          id: true,
          title: true,
          status: true,
          visibility: true,
          uploaderId: true,
          publishedAt: true,
          slug: true,
          courseId: true,
          uploader: {
            select: {
              trustLevel: true,
              roles: { select: { facultyId: true, role: { select: { key: true } } } },
            },
          },
        },
      },
    },
  });
}

/**
 * Quy trình kiểm tra tự động một phiên bản tài liệu (mục 7 tài liệu kiến trúc):
 * 1 định dạng thật và dung lượng → 2 trùng lặp SHA-256 → 3 ClamAV → 4 mở file, chuyển PDF
 * → 5 ảnh xem trước, trích văn bản → 6 chấm điểm rủi ro, gợi ý tag.
 * Lỗi nghiêm trọng ở bước 1–4 thì tự động từ chối; còn lại đưa vào hàng chờ kiểm duyệt.
 */
export async function processVersion(versionId: string, ctx: PipelineContext): Promise<void> {
  const version = await loadVersion(versionId);
  if (!version) return;

  const storage = getStorage();
  const workDir = await mkdtemp(join(tmpdir(), "khotl-"));
  const checks: Checks = {};
  const reject = (reason: string, extra: { sha256?: string } = {}) =>
    rejectVersion(version, reason, checks, extra.sha256);

  try {
    const kind = version.fileKind as FileKindKey;
    const original = join(workDir, `original.${fileExtension(version.originalName) || "bin"}`);
    await storage.downloadToFile(version.storageKey, original);
    const size = (await stat(original)).size;

    // 1. Định dạng thật (magic bytes) và dung lượng
    const detected = await fileTypeFromFile(original);
    if (!detectedTypeMatches(kind, detected?.ext)) {
      checks.format = {
        status: "fail",
        detail: `Nội dung thật là ${detected?.mime ?? "không xác định"}, không phải ${kind}`,
      };
      return await reject("Định dạng thật của file không khớp với đuôi file");
    }
    if (size > maxUploadBytes(kind, config.limits)) {
      checks.format = { status: "fail", detail: `${size} byte` };
      return await reject("File vượt dung lượng cho phép");
    }
    checks.format = { status: "pass", detail: detected?.mime, size };

    // 2. Trùng lặp với tài liệu khác đang chờ duyệt hoặc đã công khai
    const sha256 = await hashFile(original);
    const duplicate = await prisma.documentVersion.findFirst({
      where: {
        sha256,
        documentId: { not: version.documentId },
        document: { status: { in: ["PROCESSING", "PENDING_REVIEW", "APPROVED"] } },
      },
      select: { document: { select: { slug: true, title: true } } },
    });
    if (duplicate) {
      checks.duplicate = {
        status: "fail",
        detail: duplicate.document.title,
        slug: duplicate.document.slug,
      };
      return await reject(
        `Trùng với tài liệu đã có: “${duplicate.document.title}” (/tai-lieu/${duplicate.document.slug})`,
        { sha256 },
      );
    }
    checks.duplicate = { status: "pass" };

    // 3. Quét mã độc
    if (config.clamav) {
      const scan = await scanFile(original, config.clamav);
      if (scan.status === "infected") {
        checks.virus = { status: "fail", detail: scan.signature };
        await storage.delete(version.storageKey).catch(() => undefined);
        return await reject(`Phát hiện mã độc (${scan.signature}), file đã bị xóa`, { sha256 });
      }
      if (scan.status === "error") {
        if (config.clamavRequired) throw new TransientError(`ClamAV lỗi: ${scan.message}`);
        checks.virus = { status: "warn", detail: `Không quét được: ${scan.message}` };
      } else {
        checks.virus = { status: "pass" };
      }
    } else {
      if (config.clamavRequired) throw new TransientError("Chưa cấu hình ClamAV");
      checks.virus = { status: "skipped", detail: "Chưa cấu hình ClamAV" };
    }

    // 4–5. Mở file, chuyển PDF, ảnh xem trước, văn bản
    const base = `previews/${version.id}`;
    let pdfPath: string | null = null;
    let pageCount: number | null = null;
    let previewPdfKey: string | null = null;
    let thumbnailKey: string | null = null;
    const previewImageKeys: string[] = [];
    let text = "";

    if (kind === "PDF" || kind === "DOCX" || kind === "PPTX" || kind === "XLSX") {
      if (kind === "PDF") {
        pdfPath = original;
      } else if (ctx.tools.libreoffice) {
        try {
          pdfPath = await convertOfficeToPdf(original, workDir);
          checks.convert = { status: "pass", detail: "Đã chuyển sang PDF" };
        } catch {
          checks.integrity = { status: "fail", detail: "LibreOffice không mở được file" };
          return await reject("Không mở được file Office (file hỏng hoặc có mật khẩu)", { sha256 });
        }
      } else {
        checks.convert = { status: "skipped", detail: "Máy chủ chưa cài LibreOffice" };
      }

      if (pdfPath && ctx.tools.poppler) {
        try {
          pageCount = (await pdfInfo(pdfPath)).pages;
        } catch {
          checks.integrity = { status: "fail", detail: "pdfinfo không đọc được file" };
          return await reject("File PDF bị hỏng hoặc cần mật khẩu để mở", { sha256 });
        }
        checks.integrity = { status: "pass", detail: `${pageCount} trang` };

        if (pdfPath === original) {
          previewPdfKey = version.storageKey;
        } else {
          previewPdfKey = `${base}/document.pdf`;
          await storage.put(previewPdfKey, await readFile(pdfPath), "application/pdf", CACHE_IMMUTABLE);
        }

        const rendered = await renderPages(pdfPath, workDir, config.guestPreviewPages);
        for (const [index, page] of rendered.pages.entries()) {
          const key = `${base}/page-${index + 1}.webp`;
          await storage.put(key, page, "image/webp", CACHE_IMMUTABLE);
          previewImageKeys.push(key);
        }
        thumbnailKey = `${base}/thumb.webp`;
        await storage.put(thumbnailKey, rendered.thumbnail, "image/webp", CACHE_IMMUTABLE);

        text = await pdfText(pdfPath);
        checks.text = { status: "pass", detail: `${text.trim().length} ký tự` };
      } else if (pdfPath) {
        previewPdfKey = pdfPath === original ? version.storageKey : null;
        checks.integrity = { status: "skipped", detail: "Máy chủ chưa cài poppler" };
      }
    } else if (kind === "IMAGE") {
      try {
        const image = await processImage(original);
        await storage.put(version.storageKey, image.sanitized, image.contentType);
        const previewKey = `${base}/page-1.webp`;
        await storage.put(previewKey, image.preview, "image/webp", CACHE_IMMUTABLE);
        previewImageKeys.push(previewKey);
        thumbnailKey = `${base}/thumb.webp`;
        await storage.put(thumbnailKey, image.thumbnail, "image/webp", CACHE_IMMUTABLE);
        pageCount = 1;
        checks.integrity = {
          status: "pass",
          detail: `${image.width}×${image.height}, đã xóa EXIF`,
        };
      } catch {
        checks.integrity = { status: "fail", detail: "Không giải mã được ảnh" };
        return await reject("Không đọc được ảnh (file hỏng)", { sha256 });
      }
    } else if (kind === "ZIP") {
      if (ctx.tools.unzip) {
        const { stdout } = await run("unzip", ["-l", original], { timeoutMs: 30_000 });
        const inspection = parseUnzipListing(stdout);
        const verdict = judgeZip(inspection, size);
        checks.archive = {
          status: verdict.ok ? "pass" : "fail",
          detail: verdict.reason ?? `${inspection.fileCount} file`,
          files: inspection.entries.slice(0, 50).map((entry) => entry.name),
        };
        if (!verdict.ok) return await reject(verdict.reason ?? "ZIP không hợp lệ", { sha256 });
      } else {
        checks.archive = { status: "skipped", detail: "Máy chủ chưa cài unzip" };
      }
    }

    // 6a. Tài liệu trống/quá ngắn và bản gần giống tài liệu đã có (chống lách luật thưởng bằng cách đăng lại)
    const hasTextLayer = pdfPath !== null && ctx.tools.poppler;
    if (version.document.status === "PROCESSING" && isTooShort({ text, pageCount, hasTextLayer })) {
      checks.content = { status: "fail", detail: "Gần như không có nội dung chữ" };
      return await reject("Tài liệu trống hoặc quá ngắn", { sha256 });
    }
    const contentHash = simhash(text);
    if (contentHash !== null && version.document.status === "PROCESSING") {
      const near = await prisma.$queryRaw<{ slug: string; title: string }[]>`
        SELECT d.slug, d.title FROM document_versions v
        JOIN documents d ON d.id = v."documentId"
        WHERE v.simhash IS NOT NULL
          AND v."documentId" <> ${version.documentId}
          AND d.status::text IN ('PROCESSING', 'PENDING_REVIEW', 'APPROVED')
          AND bit_count((v.simhash # ${contentHash})::bit(64)) <= ${NEAR_DUPLICATE_MAX_DISTANCE}::int
        LIMIT 1`;
      const match = near[0];
      if (match) {
        checks.duplicate = { status: "fail", detail: `Gần giống: ${match.title}`, slug: match.slug };
        return await reject(
          `Nội dung gần giống tài liệu đã có: “${match.title}” (/tai-lieu/${match.slug})`,
          { sha256 },
        );
      }
    }

    // 6. Chấm điểm rủi ro nội dung và gợi ý tag
    const risk = assessContentRisk({
      text,
      pageCount,
      hasTextLayer,
      bannedWords: ctx.bannedWords,
    });
    checks.content = {
      status: risk.score >= 60 ? "warn" : "pass",
      detail: risk.reasons.join("; ") || "Không thấy dấu hiệu bất thường",
      score: risk.score,
      links: risk.linkCount,
    };
    const tags = text ? suggestTags(text) : [];

    await finalizeSuccess(version, {
      checks,
      sha256,
      simhash: contentHash,
      detectedMime: detected?.mime ?? null,
      pageCount,
      previewPdfKey,
      previewImageKeys,
      thumbnailKey,
      text,
      riskScore: risk.score,
      riskReasons: risk.reasons,
      tags,
    });
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

interface SuccessData {
  checks: Checks;
  sha256: string;
  simhash: bigint | null;
  detectedMime: string | null;
  pageCount: number | null;
  previewPdfKey: string | null;
  previewImageKeys: string[];
  thumbnailKey: string | null;
  text: string;
  riskScore: number;
  riskReasons: string[];
  tags: { name: string; slug: string }[];
}

async function finalizeSuccess(version: VersionWithDocument, data: SuccessData): Promise<void> {
  const doc = version.document;
  // Tài liệu của nhóm học tập không qua hàng chờ thủ công; tài liệu đã duyệt (vd dữ liệu mẫu) giữ nguyên trạng thái.
  // Kiểm duyệt viên và quản trị viên đăng thì công khai ngay sau kiểm tra tự động, không vào hàng chờ.
  const staffUpload = isStaff({
    roles: doc.uploader.roles.map((assignment) => ({
      key: assignment.role.key as RoleName,
      facultyId: assignment.facultyId,
    })),
  });
  const autoPublish = doc.status === "PROCESSING" && doc.visibility === "PUBLIC" && staffUpload;
  const nextStatus =
    doc.status === "PROCESSING"
      ? doc.visibility === "GROUP" || autoPublish
        ? "APPROVED"
        : "PENDING_REVIEW"
      : doc.status;

  await prisma.$transaction(async (tx) => {
    await tx.documentVersion.update({
      where: { id: version.id },
      data: {
        processingStatus: "DONE",
        processedAt: new Date(),
        lockedAt: null,
        processingError: null,
        sha256: data.sha256,
        simhash: data.simhash,
        detectedMime: data.detectedMime,
        pageCount: data.pageCount,
        previewPdfKey: data.previewPdfKey,
        previewImageKeys: data.previewImageKeys,
        thumbnailKey: data.thumbnailKey,
        checkResults: data.checks as unknown as Prisma.InputJsonValue,
        riskScore: data.riskScore,
      },
    });

    if (data.text.trim()) {
      await tx.documentContent.upsert({
        where: { versionId: version.id },
        create: {
          versionId: version.id,
          text: data.text,
          method: "pdftotext",
          charCount: data.text.length,
        },
        update: { text: data.text, charCount: data.text.length, extractedAt: new Date() },
      });
    }

    for (const tag of data.tags) {
      const record = await tx.tag.upsert({
        where: { slug: tag.slug },
        create: { name: tag.name, slug: tag.slug },
        update: {},
      });
      await tx.documentTag.upsert({
        where: { documentId_tagId: { documentId: doc.id, tagId: record.id } },
        create: { documentId: doc.id, tagId: record.id, source: "AUTO" },
        update: {},
      });
    }

    await tx.document.update({
      where: { id: doc.id },
      data: {
        status: nextStatus,
        riskScore: data.riskScore,
        priority: queuePriority(doc.uploader.trustLevel),
        publishedAt: nextStatus === "APPROVED" && !doc.publishedAt ? new Date() : undefined,
      },
    });

    await tx.moderationLog.create({
      data: {
        action: "AUTO_CHECK_PASSED",
        documentId: doc.id,
        versionId: version.id,
        metadata: { riskScore: data.riskScore, reasons: data.riskReasons },
      },
    });

    if (autoPublish) {
      // Ghi nhận như một lần duyệt để số liệu học phần, người đăng và nhật ký vẫn đúng.
      // Không cộng uy tín, không cộng lượt thưởng (nhân sự tự đăng, tải không giới hạn).
      await tx.course.update({ where: { id: doc.courseId }, data: { documentCount: { increment: 1 } } });
      await tx.user.update({
        where: { id: doc.uploaderId },
        data: { approvedDocumentCount: { increment: 1 } },
      });
      await tx.moderationLog.create({
        data: {
          action: "APPROVE",
          actorId: doc.uploaderId,
          documentId: doc.id,
          versionId: version.id,
          targetUserId: doc.uploaderId,
          internalNote: "Tự động công khai: người đăng là kiểm duyệt viên hoặc quản trị viên",
        },
      });
      await tx.notification.create({
        data: {
          userId: doc.uploaderId,
          documentId: doc.id,
          type: "DOCUMENT_APPROVED",
          data: { title: doc.title },
          link: `/tai-lieu/${doc.slug}`,
        },
      });
    }
  });

  // Cập nhật vector tìm kiếm (tiêu đề, học phần, tag, nội dung vừa trích).
  await prisma.$executeRaw`SELECT refresh_document_search(${doc.id})`;
}

async function rejectVersion(
  version: VersionWithDocument,
  reason: string,
  checks: Checks,
  sha256?: string,
): Promise<void> {
  const doc = version.document;
  const versionUpdate = prisma.documentVersion.update({
    where: { id: version.id },
    data: {
      processingStatus: "DONE",
      processedAt: new Date(),
      lockedAt: null,
      processingError: reason,
      sha256: sha256 ?? null,
      checkResults: checks as unknown as Prisma.InputJsonValue,
    },
  });

  // Chỉ tự động từ chối tài liệu đang chờ kiểm tra; tài liệu đã có quyết định khác chỉ ghi nhận lỗi.
  if (doc.status !== "PROCESSING") {
    await versionUpdate;
    return;
  }

  await prisma.$transaction([
    versionUpdate,
    prisma.document.update({
      where: { id: doc.id },
      data: { status: "REJECTED", reviewNote: reason },
    }),
    prisma.moderationLog.create({
      data: { action: "AUTO_REJECTED", documentId: doc.id, versionId: version.id, reason },
    }),
    prisma.notification.create({
      data: {
        userId: doc.uploaderId,
        type: "DOCUMENT_REJECTED",
        documentId: doc.id,
        link: "/tai-lieu-cua-toi",
        data: { title: doc.title, reason, automatic: true },
      },
    }),
  ]);
}

function hashFile(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    createReadStream(filePath)
      .on("data", (chunk) => hash.update(chunk))
      .on("end", () => resolve(hash.digest("hex")))
      .on("error", reject);
  });
}
