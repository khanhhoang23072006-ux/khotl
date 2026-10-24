"use server";

import {
  can,
  computeTrustLevel,
  fieldErrors,
  moderationDecisionSchema,
  moderationScope,
  PERMISSIONS,
  REPUTATION_FOR_APPROVAL,
} from "@khotl/core";
import { prisma } from "@khotl/db";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { type CurrentUser, getCurrentUser } from "@/lib/session";
import type { ActionResult } from "./upload";

/** Điểm uy tín bị trừ khi tài liệu đã công khai bị gỡ vì vi phạm. */
const REPUTATION_FOR_REMOVAL = -20;

async function moderator(): Promise<CurrentUser | null> {
  const user = await getCurrentUser();
  return user && can(user, PERMISSIONS.documentModerate) ? user : null;
}

function scopeFilter(user: CurrentUser) {
  const scope = moderationScope(user);
  return scope === null ? {} : { course: { facultyId: { in: scope } } };
}

async function refreshSearch(documentId: string) {
  await prisma.$executeRaw`SELECT refresh_document_search(${documentId})`;
}

/** Bậc uy tín tính lại từ số tài liệu được duyệt và số lần bị gỡ vì vi phạm. */
async function recomputeTrust(userId: string, approvedCount: number) {
  const violationCount = await prisma.moderationLog.count({
    where: { targetUserId: userId, action: "REMOVE" },
  });
  return computeTrustLevel({ approvedCount, violationCount });
}

/**
 * Duyệt, từ chối hoặc yêu cầu sửa một hay nhiều tài liệu. Mỗi tài liệu xử lý trong transaction
 * riêng và chỉ áp dụng khi tài liệu vẫn đang chờ duyệt (hai người duyệt cùng lúc không ghi đè nhau).
 */
export async function decideDocuments(
  input: z.input<typeof moderationDecisionSchema>,
): Promise<ActionResult<{ count: number; skipped: number }>> {
  const t = await getTranslations("errors");
  const user = await moderator();
  if (!user) return { ok: false, error: t("forbidden") };

  const parsed = moderationDecisionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: t("checkFields"), fields: fieldErrors(parsed.error) };
  }
  const { documentIds, decision, reason, internalNote } = parsed.data;

  const documents = await prisma.document.findMany({
    where: { id: { in: documentIds }, status: "PENDING_REVIEW", ...scopeFilter(user) },
    select: { id: true, slug: true, title: true, uploaderId: true, courseId: true, currentVersionId: true },
  });

  let count = 0;
  for (const doc of documents) {
    const applied = await prisma.$transaction(async (tx) => {
      const nextStatus =
        decision === "APPROVE" ? "APPROVED" : decision === "REJECT" ? "REJECTED" : "CHANGES_REQUESTED";
      const updated = await tx.document.updateMany({
        where: { id: doc.id, status: "PENDING_REVIEW" },
        data: {
          status: nextStatus,
          reviewNote: decision === "APPROVE" ? null : (reason ?? null),
          ...(decision === "APPROVE" ? { publishedAt: new Date() } : {}),
        },
      });
      if (updated.count === 0) return false;

      await tx.moderationLog.create({
        data: {
          action: decision,
          actorId: user.id,
          documentId: doc.id,
          versionId: doc.currentVersionId,
          targetUserId: doc.uploaderId,
          reason: reason ?? null,
          internalNote: internalNote ?? null,
        },
      });

      if (decision === "APPROVE") {
        await tx.course.update({
          where: { id: doc.courseId },
          data: { documentCount: { increment: 1 } },
        });
        const uploader = await tx.user.update({
          where: { id: doc.uploaderId },
          data: {
            approvedDocumentCount: { increment: 1 },
            reputation: { increment: REPUTATION_FOR_APPROVAL },
          },
          select: { approvedDocumentCount: true },
        });
        await tx.user.update({
          where: { id: doc.uploaderId },
          data: { trustLevel: await recomputeTrust(doc.uploaderId, uploader.approvedDocumentCount) },
        });
        await tx.reputationEvent.create({
          data: {
            userId: doc.uploaderId,
            delta: REPUTATION_FOR_APPROVAL,
            reason: "DOCUMENT_APPROVED",
            documentId: doc.id,
            sourceUserId: user.id,
          },
        });
      }

      await tx.notification.create({
        data: {
          userId: doc.uploaderId,
          actorId: user.id,
          documentId: doc.id,
          type:
            decision === "APPROVE"
              ? "DOCUMENT_APPROVED"
              : decision === "REJECT"
                ? "DOCUMENT_REJECTED"
                : "DOCUMENT_CHANGES_REQUESTED",
          data: { title: doc.title, ...(reason ? { reason } : {}) },
          link:
            decision === "APPROVE"
              ? `/tai-lieu/${doc.slug}`
              : decision === "REQUEST_CHANGES"
                ? `/tai-lieu-cua-toi/${doc.id}/sua`
                : "/tai-lieu-cua-toi",
        },
      });
      return true;
    });
    if (applied) {
      count++;
      if (decision === "APPROVE") await refreshSearch(doc.id);
    }
  }

  revalidatePath("/kiem-duyet");
  revalidatePath("/");
  return { ok: true, count, skipped: documentIds.length - count };
}

const removeSchema = z.object({
  documentId: z.string().min(1),
  reason: z.string().trim().min(3, "Cần ghi lý do").max(1000),
  reportId: z.string().optional(),
});

/** Gỡ tài liệu đã công khai (vi phạm, bản quyền). Đóng luôn các báo cáo đang mở về tài liệu đó. */
export async function removeDocument(
  input: z.input<typeof removeSchema>,
): Promise<ActionResult> {
  const t = await getTranslations("errors");
  const user = await moderator();
  if (!user) return { ok: false, error: t("forbidden") };
  const parsed = removeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: t("checkFields"), fields: fieldErrors(parsed.error) };
  }
  const { documentId, reason, reportId } = parsed.data;

  const doc = await prisma.document.findFirst({
    where: { id: documentId, ...scopeFilter(user) },
    select: { id: true, title: true, status: true, uploaderId: true, courseId: true },
  });
  if (!doc) return { ok: false, error: t("notFound") };
  if (doc.status === "REMOVED") return { ok: false, error: t("alreadyRemoved") };

  await prisma.$transaction(async (tx) => {
    await tx.document.update({ where: { id: doc.id }, data: { status: "REMOVED", reviewNote: reason } });
    if (doc.status === "APPROVED") {
      await tx.course.update({
        where: { id: doc.courseId },
        data: { documentCount: { decrement: 1 } },
      });
      await tx.user.update({
        where: { id: doc.uploaderId },
        data: {
          approvedDocumentCount: { decrement: 1 },
          reputation: { increment: REPUTATION_FOR_REMOVAL },
        },
      });
      await tx.reputationEvent.create({
        data: {
          userId: doc.uploaderId,
          delta: REPUTATION_FOR_REMOVAL,
          reason: "CONTENT_REMOVED",
          documentId: doc.id,
          sourceUserId: user.id,
        },
      });
    }
    await tx.moderationLog.create({
      data: {
        action: "REMOVE",
        actorId: user.id,
        documentId: doc.id,
        targetUserId: doc.uploaderId,
        reportId: reportId ?? null,
        reason,
      },
    });
    await tx.report.updateMany({
      where: { documentId: doc.id, status: { in: ["OPEN", "IN_REVIEW"] } },
      data: { status: "RESOLVED", resolvedById: user.id, resolvedAt: new Date(), resolution: reason },
    });
    await tx.notification.create({
      data: {
        userId: doc.uploaderId,
        actorId: user.id,
        documentId: doc.id,
        type: "DOCUMENT_REMOVED",
        data: { title: doc.title, reason },
        link: "/tai-lieu-cua-toi",
      },
    });
  });

  // Bậc uy tín có thể giảm sau khi bị gỡ
  const uploader = await prisma.user.findUnique({
    where: { id: doc.uploaderId },
    select: { approvedDocumentCount: true },
  });
  if (uploader) {
    await prisma.user.update({
      where: { id: doc.uploaderId },
      data: { trustLevel: await recomputeTrust(doc.uploaderId, uploader.approvedDocumentCount) },
    });
  }
  await refreshSearch(doc.id);

  revalidatePath("/kiem-duyet/bao-cao");
  revalidatePath("/");
  return { ok: true };
}

const dismissSchema = z.object({
  reportId: z.string().min(1),
  resolution: z.string().trim().max(1000).optional(),
});

/** Bỏ qua báo cáo không có cơ sở. */
export async function dismissReport(input: z.input<typeof dismissSchema>): Promise<ActionResult> {
  const t = await getTranslations("errors");
  const user = await getCurrentUser();
  if (!user || !can(user, PERMISSIONS.reportResolve)) return { ok: false, error: t("forbidden") };
  const parsed = dismissSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: t("checkFields") };

  const report = await prisma.report.findUnique({
    where: { id: parsed.data.reportId },
    select: { id: true, status: true, documentId: true, document: { select: { course: { select: { facultyId: true } } } } },
  });
  if (!report) return { ok: false, error: t("notFound") };
  const facultyId = report.document?.course.facultyId ?? null;
  if (!can(user, PERMISSIONS.reportResolve, { facultyId })) return { ok: false, error: t("forbidden") };
  if (report.status === "RESOLVED" || report.status === "DISMISSED") {
    return { ok: false, error: t("alreadyHandled") };
  }

  await prisma.$transaction([
    prisma.report.update({
      where: { id: report.id },
      data: {
        status: "DISMISSED",
        resolvedById: user.id,
        resolvedAt: new Date(),
        resolution: parsed.data.resolution ?? null,
      },
    }),
    prisma.moderationLog.create({
      data: {
        action: "DISMISS_REPORT",
        actorId: user.id,
        reportId: report.id,
        documentId: report.documentId,
        reason: parsed.data.resolution ?? null,
      },
    }),
  ]);
  revalidatePath("/kiem-duyet/bao-cao");
  return { ok: true };
}
