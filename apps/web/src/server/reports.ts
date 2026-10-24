"use server";

import { getRateLimiter } from "@khotl/adapters";
import { can, fieldErrors, PERMISSIONS, reportSchema, takedownSchema } from "@khotl/core";
import { prisma } from "@khotl/db";
import { getTranslations } from "next-intl/server";
import type { z } from "zod";
import { clientIp } from "@/lib/request";
import { getCurrentUser } from "@/lib/session";
import type { ActionResult } from "./upload";

/** Sinh viên báo cáo tài liệu vi phạm. Mỗi người chỉ có một báo cáo đang mở cho mỗi tài liệu. */
export async function createReport(input: z.input<typeof reportSchema>): Promise<ActionResult> {
  const t = await getTranslations("errors");
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: t("signInRequired") };
  if (!can(user, PERMISSIONS.reportCreate)) return { ok: false, error: t("forbidden") };

  const parsed = reportSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: t("checkFields"), fields: fieldErrors(parsed.error) };
  }
  const rate = await getRateLimiter().hit(`report:${user.id}`, 10, 3600);
  if (!rate.ok) return { ok: false, error: t("tooManyRequests") };

  const doc = await prisma.document.findFirst({
    where: { id: parsed.data.documentId, status: "APPROVED", deletedAt: null },
    select: { id: true, uploaderId: true },
  });
  if (!doc) return { ok: false, error: t("notFound") };

  const existing = await prisma.report.findFirst({
    where: { documentId: doc.id, reporterId: user.id, status: { in: ["OPEN", "IN_REVIEW"] } },
    select: { id: true },
  });
  if (existing) return { ok: false, error: t("alreadyReported") };

  await prisma.report.create({
    data: {
      targetType: "DOCUMENT",
      reason: parsed.data.reason,
      details: parsed.data.details ?? null,
      reporterId: user.id,
      documentId: doc.id,
      reportedUserId: doc.uploaderId,
    },
  });
  return { ok: true };
}

/** Lấy slug tài liệu từ đường dẫn người khiếu nại dán vào (đầy đủ hoặc chỉ phần /tai-lieu/...). */
function slugFromUrl(value: string): string | null {
  const match = value.match(/\/tai-lieu\/([a-z0-9-]+)/i);
  if (match?.[1]) return match[1].toLowerCase();
  return /^[a-z0-9-]+$/i.test(value) ? value.toLowerCase() : null;
}

/** Yêu cầu gỡ vì bản quyền, dành cho cả người ngoài trường (không cần đăng nhập). */
export async function submitTakedown(input: z.input<typeof takedownSchema>): Promise<ActionResult> {
  const t = await getTranslations("errors");
  const parsed = takedownSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: t("checkFields"), fields: fieldErrors(parsed.error) };
  }
  const rate = await getRateLimiter().hit(`takedown:${await clientIp()}`, 5, 24 * 3600);
  if (!rate.ok) return { ok: false, error: t("tooManyRequests") };

  const slug = slugFromUrl(parsed.data.documentUrl.trim());
  const doc = slug
    ? await prisma.document.findUnique({ where: { slug }, select: { id: true, uploaderId: true } })
    : null;
  if (!doc) {
    return { ok: false, error: t("checkFields"), fields: { documentUrl: t("documentUrlNotFound") } };
  }

  await prisma.report.create({
    data: {
      targetType: "DOCUMENT",
      reason: "COPYRIGHT",
      details: parsed.data.details,
      reporterEmail: parsed.data.email.toLowerCase(),
      reporterId: (await getCurrentUser())?.id ?? null,
      documentId: doc.id,
      reportedUserId: doc.uploaderId,
      evidence: { fullName: parsed.data.fullName, documentUrl: parsed.data.documentUrl, takedown: true },
    },
  });
  return { ok: true };
}
