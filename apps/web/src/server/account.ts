"use server";

import { fieldErrors, profileSchema } from "@khotl/core";
import { prisma } from "@khotl/db";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import type { z } from "zod";
import { LOCALE_COOKIE, toLocale } from "@/i18n/config";
import { getCurrentUser } from "@/lib/session";
import type { ActionResult } from "./upload";

/** Bước hoàn thiện hồ sơ sau lần đăng nhập đầu: username, Viện, khóa. */
export async function saveProfile(input: z.input<typeof profileSchema>): Promise<ActionResult> {
  const t = await getTranslations("errors");
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: t("signInRequired") };

  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: t("checkFields"), fields: fieldErrors(parsed.error) };
  }
  const data = parsed.data;

  const [taken, faculty] = await Promise.all([
    prisma.user.findFirst({
      where: { username: data.username, NOT: { id: user.id } },
      select: { id: true },
    }),
    prisma.faculty.findUnique({ where: { id: data.facultyId }, select: { id: true } }),
  ]);
  if (taken) return { ok: false, error: t("checkFields"), fields: { username: t("usernameTaken") } };
  if (!faculty) return { ok: false, error: t("checkFields"), fields: { facultyId: t("notFound") } };

  await prisma.user.update({
    where: { id: user.id },
    data: {
      username: data.username,
      displayName: data.displayName ?? null,
      facultyId: faculty.id,
      cohort: data.cohort,
      studentCode: data.studentCode ?? null,
    },
  });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function markAllNotificationsRead(): Promise<ActionResult> {
  const t = await getTranslations("errors");
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: t("signInRequired") };
  await prisma.notification.updateMany({
    where: { userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Đổi ngôn ngữ giao diện: lưu cookie (cả khách) và hồ sơ (nếu đã đăng nhập). */
export async function setLocale(value: string): Promise<void> {
  const locale = toLocale(value);
  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    httpOnly: false,
  });
  const user = await getCurrentUser();
  if (user) await prisma.user.update({ where: { id: user.id }, data: { locale } });
  revalidatePath("/", "layout");
}
