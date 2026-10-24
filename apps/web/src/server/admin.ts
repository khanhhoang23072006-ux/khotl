"use server";

import { can, courseSchema, fieldErrors, PERMISSIONS } from "@khotl/core";
import { type Prisma, prisma } from "@khotl/db";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { hashedIp } from "@/lib/request";
import { type CurrentUser, getCurrentUser } from "@/lib/session";
import type { ActionResult } from "./upload";

async function admin(permission: (typeof PERMISSIONS)[keyof typeof PERMISSIONS]) {
  const user = await getCurrentUser();
  return user && can(user, permission) ? user : null;
}

/** Nhật ký quản trị: bảng audit_logs chỉ cho thêm, trigger chặn sửa/xóa. */
async function audit(
  actor: CurrentUser,
  action: string,
  entityType: string,
  entityId: string | null,
  before: Prisma.InputJsonValue | undefined,
  after: Prisma.InputJsonValue | undefined,
) {
  await prisma.auditLog.create({
    data: {
      actorId: actor.id,
      action,
      entityType,
      entityId,
      before,
      after,
      ipHash: await hashedIp(),
      userAgent: (await headers()).get("user-agent")?.slice(0, 300) ?? null,
    },
  });
}

export async function createCourse(input: z.input<typeof courseSchema>): Promise<ActionResult> {
  const t = await getTranslations("errors");
  const user = await admin(PERMISSIONS.adminCatalog);
  if (!user) return { ok: false, error: t("forbidden") };
  const parsed = courseSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: t("checkFields"), fields: fieldErrors(parsed.error) };
  }
  const data = parsed.data;
  const exists = await prisma.course.findUnique({ where: { code: data.code }, select: { id: true } });
  if (exists) return { ok: false, error: t("checkFields"), fields: { code: t("courseExists") } };

  const course = await prisma.course.create({
    data: {
      code: data.code,
      slug: data.code.toLowerCase(),
      name: data.name,
      nameEn: data.nameEn ?? null,
      credits: data.credits ?? null,
      facultyId: data.facultyId,
    },
  });
  await audit(user, "course.create", "Course", course.id, undefined, {
    code: course.code,
    name: course.name,
    facultyId: course.facultyId,
  });
  revalidatePath("/quan-tri/hoc-phan");
  return { ok: true };
}

export interface ImportSummary {
  created: number;
  updated: number;
  errors: { line: number; message: string }[];
}

/**
 * Nhập học phần từ CSV: mỗi dòng "mã,tên,tên tiếng Anh,số tín chỉ,mã Viện".
 * Dòng tiêu đề (bắt đầu bằng "ma" hoặc "code") được bỏ qua. Mã đã có thì cập nhật.
 */
export async function importCourses(csv: string): Promise<ActionResult<ImportSummary>> {
  const t = await getTranslations("errors");
  const user = await admin(PERMISSIONS.adminCatalog);
  if (!user) return { ok: false, error: t("forbidden") };
  if (csv.length > 500_000) return { ok: false, error: t("csvTooLarge") };

  const faculties = await prisma.faculty.findMany({ select: { id: true, code: true } });
  const facultyByCode = new Map(faculties.map((faculty) => [faculty.code.toUpperCase(), faculty.id]));
  const summary: ImportSummary = { created: 0, updated: 0, errors: [] };

  const lines = csv.split(/\r?\n/);
  for (const [index, raw] of lines.entries()) {
    const line = raw.trim();
    if (!line || /^(ma|mã|code)\s*[,;]/i.test(line)) continue;
    const cells = parseCsvLine(line);
    const [code, name, nameEn, credits, facultyCode] = cells.map((cell) => cell.trim());
    const facultyId = facultyByCode.get((facultyCode ?? "").toUpperCase());
    if (!facultyId) {
      summary.errors.push({ line: index + 1, message: t("facultyCodeUnknown", { code: facultyCode ?? "" }) });
      continue;
    }
    const parsed = courseSchema.safeParse({
      code,
      name,
      nameEn: nameEn || undefined,
      credits: credits || undefined,
      facultyId,
    });
    if (!parsed.success) {
      summary.errors.push({ line: index + 1, message: parsed.error.issues[0]?.message ?? t("checkFields") });
      continue;
    }
    const data = parsed.data;
    const existing = await prisma.course.findUnique({ where: { code: data.code }, select: { id: true } });
    await prisma.course.upsert({
      where: { code: data.code },
      create: {
        code: data.code,
        slug: data.code.toLowerCase(),
        name: data.name,
        nameEn: data.nameEn ?? null,
        credits: data.credits ?? null,
        facultyId: data.facultyId,
      },
      update: {
        name: data.name,
        nameEn: data.nameEn ?? null,
        credits: data.credits ?? null,
        facultyId: data.facultyId,
      },
    });
    if (existing) summary.updated++;
    else summary.created++;
    if (summary.errors.length > 200) break;
  }

  await audit(user, "course.import", "Course", null, undefined, {
    created: summary.created,
    updated: summary.updated,
    errors: summary.errors.length,
  });
  revalidatePath("/quan-tri/hoc-phan");
  return { ok: true, ...summary };
}

/** Tách một dòng CSV, hỗ trợ ô có dấu phẩy đặt trong ngoặc kép. Chấp nhận cả dấu chấm phẩy. */
function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (quoted) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        current += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === "," || char === ";") {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells;
}

const grantSchema = z.object({
  email: z.email(),
  role: z.enum(["MODERATOR", "ADMIN"]),
  facultyId: z.string().optional(),
});

/** Giao vai trò kiểm duyệt viên (toàn hệ thống hoặc theo Viện) hoặc quản trị viên. */
export async function grantRole(input: z.input<typeof grantSchema>): Promise<ActionResult> {
  const t = await getTranslations("errors");
  const user = await admin(PERMISSIONS.adminUsers);
  if (!user) return { ok: false, error: t("forbidden") };
  const parsed = grantSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: t("checkFields"), fields: fieldErrors(parsed.error) };
  }
  const { email, role, facultyId } = parsed.data;
  const scopeId = role === "MODERATOR" && facultyId ? facultyId : null;

  const target = await prisma.user.findUnique({ where: { email: email.toLowerCase() }, select: { id: true } });
  if (!target) return { ok: false, error: t("checkFields"), fields: { email: t("userNotFound") } };
  const roleRecord = await prisma.role.findUnique({ where: { key: role } });
  if (!roleRecord) return { ok: false, error: t("notFound") };

  const existing = await prisma.userRole.findFirst({
    where: { userId: target.id, roleId: roleRecord.id, facultyId: scopeId },
    select: { id: true },
  });
  if (existing) return { ok: false, error: t("roleExists") };

  const created = await prisma.userRole.create({
    data: { userId: target.id, roleId: roleRecord.id, facultyId: scopeId, grantedById: user.id },
  });
  await audit(user, "role.grant", "UserRole", created.id, undefined, {
    userId: target.id,
    role,
    facultyId: scopeId,
  });
  revalidatePath("/quan-tri/nguoi-dung");
  return { ok: true };
}

export async function revokeRole(userRoleId: string): Promise<ActionResult> {
  const t = await getTranslations("errors");
  const user = await admin(PERMISSIONS.adminUsers);
  if (!user) return { ok: false, error: t("forbidden") };
  const assignment = await prisma.userRole.findUnique({
    where: { id: userRoleId },
    include: { role: { select: { key: true } } },
  });
  if (!assignment || assignment.role.key === "STUDENT") return { ok: false, error: t("notFound") };
  // Không tự gỡ quyền quản trị của chính mình để tránh khóa hệ thống
  if (assignment.userId === user.id && assignment.role.key === "ADMIN") {
    return { ok: false, error: t("cannotRevokeSelf") };
  }
  await prisma.userRole.delete({ where: { id: assignment.id } });
  await audit(
    user,
    "role.revoke",
    "UserRole",
    assignment.id,
    { userId: assignment.userId, role: assignment.role.key, facultyId: assignment.facultyId },
    undefined,
  );
  revalidatePath("/quan-tri/nguoi-dung");
  return { ok: true };
}
