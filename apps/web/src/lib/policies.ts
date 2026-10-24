import "server-only";
import { can, dailyUploadLimit, PERMISSIONS, vietnamDay } from "@khotl/core";
import { prisma, type SanctionType } from "@khotl/db";
import type { CurrentUser } from "./session";

/** Lúc 00:00 hôm nay theo giờ Việt Nam (UTC+7). */
export function startOfVietnamDay(now: Date = new Date()): Date {
  return new Date(vietnamDay(now).getTime() - 7 * 3_600_000);
}

export interface UploadQuota {
  limit: number;
  used: number;
  remaining: number;
}

/** Hạn mức tải lên trong ngày theo bậc uy tín (bậc 0: 3 file, bậc 3: 50 file). */
export async function uploadQuota(user: Pick<CurrentUser, "id" | "trustLevel">): Promise<UploadQuota> {
  const limit = dailyUploadLimit(user.trustLevel);
  const used = await prisma.document.count({
    where: { uploaderId: user.id, createdAt: { gte: startOfVietnamDay() } },
  });
  return { limit, used, remaining: Math.max(0, limit - used) };
}

export async function activeSanction(userId: string, types: SanctionType[]) {
  return prisma.userSanction.findFirst({
    where: {
      userId,
      type: { in: types },
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    select: { type: true, reason: true, expiresAt: true },
  });
}

export interface DocumentAccessInput {
  status: string;
  visibility: string;
  uploaderId: string;
  deletedAt: Date | null;
  course: { facultyId: string };
}

/**
 * Ai được xem một tài liệu:
 * - công khai: tài liệu đã duyệt, hiển thị công khai, chưa xóa;
 * - người đăng luôn xem được tài liệu của mình (trừ khi đã xóa);
 * - kiểm duyệt viên xem được tài liệu thuộc Viện mình phụ trách.
 */
export function documentAccess(
  doc: DocumentAccessInput,
  user: CurrentUser | null,
): "public" | "owner" | "moderator" | null {
  if (doc.deletedAt) return null;
  if (doc.status === "APPROVED" && doc.visibility === "PUBLIC") return "public";
  if (!user) return null;
  if (doc.uploaderId === user.id) return "owner";
  if (can(user, PERMISSIONS.documentModerate, { facultyId: doc.course.facultyId })) return "moderator";
  return null;
}
