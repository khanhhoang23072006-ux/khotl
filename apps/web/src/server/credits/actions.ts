"use server";

import { CREDIT_SETTINGS_BOUNDS, type CreditSettings, can, PERMISSIONS } from "@khotl/core";
import { prisma } from "@khotl/db";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/lib/session";
import type { ActionResult } from "../upload";
import { adjustCredits, saveCreditSettings, unlockRewards } from "./ledger";

async function admin() {
  const user = await getCurrentUser();
  return user && can(user, PERMISSIONS.adminCatalog) ? user : null;
}

/** Lưu cấu hình hạn mức (giá trị ngoài giới hạn bị kẹp lại, ghi nhật ký kiểm toán). */
export async function saveCreditSettingsAction(values: Record<string, string>): Promise<ActionResult> {
  const t = await getTranslations("errors");
  const user = await admin();
  if (!user) return { ok: false, error: t("forbidden") };
  const next: Partial<CreditSettings> = {};
  for (const key of Object.keys(CREDIT_SETTINGS_BOUNDS) as (keyof CreditSettings)[]) {
    const raw = values[key];
    if (raw === undefined || raw.trim() === "") continue;
    const number = Number(raw);
    if (!Number.isFinite(number)) return { ok: false, error: t("checkFields"), fields: { [key]: t("checkFields") } };
    next[key] = number;
  }
  await saveCreditSettings(next, user.id);
  revalidatePath("/quan-tri/luot-tai");
  revalidatePath("/luot-tai");
  return { ok: true };
}

/** Cộng hoặc trừ tay lượt thưởng cho một tài khoản. */
export async function adjustCreditsAction(input: {
  email: string;
  amount: number;
  note: string;
}): Promise<ActionResult> {
  const t = await getTranslations("credits.admin");
  const te = await getTranslations("errors");
  const user = await admin();
  if (!user) return { ok: false, error: te("forbidden") };
  const amount = Math.trunc(Number(input.amount));
  const note = input.note.trim().slice(0, 500);
  const fields: Record<string, string> = {};
  if (!Number.isFinite(amount) || amount === 0 || Math.abs(amount) > 1000) fields.amount = t("amountInvalid");
  if (note.length < 3) fields.note = t("noteRequired");
  const target = await prisma.user.findUnique({
    where: { email: input.email.trim().toLowerCase() },
    select: { id: true },
  });
  if (!target) fields.email = t("userNotFound");
  if (Object.keys(fields).length > 0 || !target) return { ok: false, error: te("checkFields"), fields };
  await adjustCredits({ userId: target.id, amount, note, actorId: user.id });
  revalidatePath("/quan-tri/luot-tai");
  return { ok: true };
}

export async function unlockRewardsAction(userId: string): Promise<ActionResult> {
  const te = await getTranslations("errors");
  const user = await admin();
  if (!user) return { ok: false, error: te("forbidden") };
  await unlockRewards(prisma, userId, user.id);
  revalidatePath("/quan-tri/luot-tai");
  return { ok: true };
}
