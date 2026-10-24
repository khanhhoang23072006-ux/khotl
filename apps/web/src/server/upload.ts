"use server";

import { randomUUID } from "node:crypto";
import { getRateLimiter, getStorage } from "@khotl/adapters";
import {
  can,
  fieldErrors,
  fileExtension,
  type FileKindKey,
  maxUploadBytes,
  normalizeTagInput,
  PERMISSIONS,
  queuePriority,
  slugify,
  uploadRuleForFile,
  uploadStartSchema,
  uploadSubmitSchema,
} from "@khotl/core";
import { type Prisma, prisma } from "@khotl/db";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { serverEnv } from "@/lib/env";
import { activeSanction, uploadQuota } from "@/lib/policies";
import { type CurrentUser, getCurrentUser } from "@/lib/session";
import { createUploadToken, type UploadTokenPayload, verifyUploadToken } from "@/lib/upload-token";

export type ActionResult<T = object> =
  | ({ ok: true } & T)
  | { ok: false; error: string; fields?: Record<string, string> };

/** Kiểm tra chung trước khi cho tải lên: đăng nhập, hồ sơ, quyền, lệnh cấm. */
async function uploader(): Promise<{ user: CurrentUser } | { error: string }> {
  const t = await getTranslations("errors");
  const user = await getCurrentUser();
  if (!user) return { error: t("signInRequired") };
  if (!user.profileComplete) return { error: t("profileRequired") };
  if (!can(user, PERMISSIONS.documentUpload)) return { error: t("forbidden") };
  if (await activeSanction(user.id, ["UPLOAD_BAN", "SITE_BAN"])) return { error: t("uploadBanned") };
  return { user };
}

/**
 * Bước 1: cấp URL ký sẵn để trình duyệt PUT file thẳng lên kho (không đi qua server web),
 * kèm token ký HMAC mô tả file. Chưa ghi gì vào CSDL ở bước này.
 */
export async function startUpload(
  input: z.input<typeof uploadStartSchema>,
): Promise<ActionResult<{ url: string; token: string; contentType: string }>> {
  const t = await getTranslations("errors");
  const gate = await uploader();
  if ("error" in gate) return { ok: false, error: gate.error };
  const { user } = gate;

  const parsed = uploadStartSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: t("invalidFile") };
  const { fileName, fileSize } = parsed.data;

  const rule = uploadRuleForFile(fileName);
  if (!rule) return { ok: false, error: t("unsupportedFormat") };
  const maxBytes = maxUploadBytes(rule.kind, serverEnv.uploadLimits);
  if (fileSize > maxBytes) {
    return { ok: false, error: t("tooLarge", { mb: Math.round(maxBytes / 1024 / 1024) }) };
  }

  const quota = await uploadQuota(user);
  if (quota.remaining <= 0) return { ok: false, error: t("quotaExceeded", { limit: quota.limit }) };

  const rate = await getRateLimiter().hit(`upload:start:${user.id}`, 30, 3600);
  if (!rate.ok) return { ok: false, error: t("tooManyRequests") };

  const contentType = rule.mimes[0] ?? "application/octet-stream";
  const key = `originals/${user.id}/${randomUUID()}.${fileExtension(fileName)}`;
  const url = await getStorage().presignPut(key, contentType, 15 * 60);
  const token = createUploadToken(
    {
      key,
      userId: user.id,
      fileName,
      size: fileSize,
      contentType,
      kind: rule.kind,
      exp: Math.floor(Date.now() / 1000) + 2 * 3600,
    },
    serverEnv.authSecret,
  );
  return { ok: true, url, token, contentType };
}

/** Xác minh token và kiểm tra file đã thật sự nằm trên kho với dung lượng hợp lệ. */
async function verifyUploadedFile(
  token: string,
  userId: string,
): Promise<{ file: UploadTokenPayload; size: number } | { error: string }> {
  const t = await getTranslations("errors");
  const verified = verifyUploadToken(token, serverEnv.authSecret);
  if (!verified.ok || verified.payload.userId !== userId) return { error: t("uploadExpired") };
  const file = verified.payload;

  const storage = getStorage();
  const head = await storage.head(file.key);
  if (!head) return { error: t("fileMissing") };
  if (head.size > maxUploadBytes(file.kind as FileKindKey, serverEnv.uploadLimits)) {
    await storage.delete(file.key).catch(() => undefined);
    return { error: t("tooLarge", { mb: serverEnv.uploadLimits.maxMb }) };
  }
  const used = await prisma.documentVersion.findUnique({
    where: { storageKey: file.key },
    select: { id: true },
  });
  if (used) return { error: t("alreadySubmitted") };
  return { file, size: head.size };
}

function cleanTags(raw: readonly string[]) {
  const unique = new Map<string, { name: string; slug: string }>();
  for (const value of raw) {
    const tag = normalizeTagInput(value);
    if (tag && !unique.has(tag.slug)) unique.set(tag.slug, tag);
  }
  return [...unique.values()].slice(0, 10);
}

async function attachTags(
  tx: Prisma.TransactionClient,
  documentId: string,
  tags: { name: string; slug: string }[],
) {
  for (const tag of tags) {
    const record = await tx.tag.upsert({
      where: { slug: tag.slug },
      create: { name: tag.name, slug: tag.slug, usageCount: 1 },
      update: { usageCount: { increment: 1 } },
    });
    await tx.documentTag.upsert({
      where: { documentId_tagId: { documentId, tagId: record.id } },
      create: { documentId, tagId: record.id, source: "USER" },
      update: {},
    });
  }
}

/**
 * Bước 2: sau khi PUT xong, trình duyệt gửi metadata. Tạo Document (PROCESSING) và
 * DocumentVersion (QUEUED) trong một transaction; worker sẽ nhận việc kiểm tra tự động.
 */
export async function submitUpload(
  input: z.input<typeof uploadSubmitSchema>,
): Promise<ActionResult<{ id: string; slug: string }>> {
  const t = await getTranslations("errors");
  const gate = await uploader();
  if ("error" in gate) return { ok: false, error: gate.error };
  const { user } = gate;

  const parsed = uploadSubmitSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: t("checkFields"), fields: fieldErrors(parsed.error) };
  }
  const data = parsed.data;

  const checked = await verifyUploadedFile(data.token, user.id);
  if ("error" in checked) return { ok: false, error: checked.error };
  const { file, size } = checked;

  const course = await prisma.course.findUnique({ where: { id: data.courseId }, select: { id: true } });
  if (!course) return { ok: false, error: t("checkFields"), fields: { courseId: t("courseNotFound") } };

  const quota = await uploadQuota(user);
  if (quota.remaining <= 0) return { ok: false, error: t("quotaExceeded", { limit: quota.limit }) };

  const tags = cleanTags(data.tags);
  const document = await prisma.$transaction(async (tx) => {
    const created = await tx.document.create({
      data: {
        slug: `${slugify(data.title, 70)}-${randomUUID().slice(0, 6)}`,
        title: data.title,
        description: data.description ?? null,
        type: data.type,
        status: "PROCESSING",
        courseId: course.id,
        uploaderId: user.id,
        term: data.term ?? null,
        academicYear: data.term ? Number(data.term.slice(0, 4)) : null,
        isAnonymous: data.isAnonymous,
        copyrightAcceptedAt: new Date(),
        priority: queuePriority(user.trustLevel),
      },
    });
    const version = await tx.documentVersion.create({
      data: {
        documentId: created.id,
        versionNumber: 1,
        originalName: file.fileName,
        storageKey: file.key,
        fileKind: file.kind as FileKindKey,
        declaredMime: file.contentType,
        sizeBytes: BigInt(size),
        processingStatus: "QUEUED",
        uploadedAt: new Date(),
      },
    });
    await tx.document.update({ where: { id: created.id }, data: { currentVersionId: version.id } });
    await attachTags(tx, created.id, tags);
    return created;
  });

  revalidatePath("/tai-lieu-cua-toi");
  return { ok: true, id: document.id, slug: document.slug };
}

const resubmitSchema = uploadSubmitSchema.extend({
  documentId: z.string().min(1),
  token: z.string().min(20).optional(),
});

/**
 * Người đăng sửa tài liệu bị yêu cầu chỉnh sửa. Có file mới thì tạo phiên bản mới và chạy lại
 * kiểm tra tự động; chỉ sửa thông tin thì quay lại hàng chờ kiểm duyệt ngay.
 */
export async function resubmitDocument(
  input: z.input<typeof resubmitSchema>,
): Promise<ActionResult<{ slug: string }>> {
  const t = await getTranslations("errors");
  const gate = await uploader();
  if ("error" in gate) return { ok: false, error: gate.error };
  const { user } = gate;

  const parsed = resubmitSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: t("checkFields"), fields: fieldErrors(parsed.error) };
  }
  const data = parsed.data;

  const document = await prisma.document.findUnique({
    where: { id: data.documentId },
    select: { id: true, slug: true, uploaderId: true, status: true },
  });
  if (!document || document.uploaderId !== user.id) return { ok: false, error: t("notFound") };
  if (document.status !== "CHANGES_REQUESTED") return { ok: false, error: t("notEditable") };

  const course = await prisma.course.findUnique({ where: { id: data.courseId }, select: { id: true } });
  if (!course) return { ok: false, error: t("checkFields"), fields: { courseId: t("courseNotFound") } };

  let upload: { file: UploadTokenPayload; size: number } | null = null;
  if (data.token) {
    const checked = await verifyUploadedFile(data.token, user.id);
    if ("error" in checked) return { ok: false, error: checked.error };
    upload = checked;
  }

  const tags = cleanTags(data.tags);
  try {
    await resubmitInTransaction(document.id, user, data, upload, tags);
  } catch (error) {
    if (error instanceof Error && error.message === "STALE") {
      return { ok: false, error: t("notEditable") };
    }
    throw error;
  }

  revalidatePath("/tai-lieu-cua-toi");
  return { ok: true, slug: document.slug };
}

async function resubmitInTransaction(
  documentId: string,
  user: CurrentUser,
  data: z.output<typeof resubmitSchema>,
  upload: { file: UploadTokenPayload; size: number } | null,
  tags: { name: string; slug: string }[],
) {
  const document = { id: documentId };
  const course = { id: data.courseId };
  await prisma.$transaction(async (tx) => {
    let currentVersionId: string | undefined;
    if (upload) {
      const last = await tx.documentVersion.findFirst({
        where: { documentId: document.id },
        orderBy: { versionNumber: "desc" },
        select: { versionNumber: true },
      });
      const version = await tx.documentVersion.create({
        data: {
          documentId: document.id,
          versionNumber: (last?.versionNumber ?? 0) + 1,
          originalName: upload.file.fileName,
          storageKey: upload.file.key,
          fileKind: upload.file.kind as FileKindKey,
          declaredMime: upload.file.contentType,
          sizeBytes: BigInt(upload.size),
          processingStatus: "QUEUED",
          uploadedAt: new Date(),
        },
      });
      currentVersionId = version.id;
    }

    // Chỉ cập nhật khi vẫn đang ở trạng thái cần sửa (tránh gửi trùng hai lần)
    const updated = await tx.document.updateMany({
      where: { id: document.id, status: "CHANGES_REQUESTED" },
      data: {
        title: data.title,
        description: data.description ?? null,
        type: data.type,
        courseId: course.id,
        term: data.term ?? null,
        academicYear: data.term ? Number(data.term.slice(0, 4)) : null,
        isAnonymous: data.isAnonymous,
        copyrightAcceptedAt: new Date(),
        status: upload ? "PROCESSING" : "PENDING_REVIEW",
        priority: queuePriority(user.trustLevel),
        ...(currentVersionId ? { currentVersionId } : {}),
      },
    });
    if (updated.count === 0) throw new Error("STALE");

    const userTags = await tx.documentTag.findMany({
      where: { documentId: document.id, source: "USER" },
      select: { tagId: true },
    });
    if (userTags.length > 0) {
      await tx.documentTag.deleteMany({ where: { documentId: document.id, source: "USER" } });
      await tx.tag.updateMany({
        where: { id: { in: userTags.map((tag) => tag.tagId) }, usageCount: { gt: 0 } },
        data: { usageCount: { decrement: 1 } },
      });
    }
    await attachTags(tx, document.id, tags);

    await tx.moderationLog.create({
      data: {
        action: "NOTE",
        actorId: user.id,
        documentId: document.id,
        versionId: currentVersionId,
        reason: upload ? "Người đăng gửi lại kèm file mới" : "Người đăng sửa thông tin và gửi lại",
      },
    });
  });
}
