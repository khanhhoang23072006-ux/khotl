"use server";

import { getMailer, getRateLimiter } from "@khotl/adapters";
import {
  FEEDBACK_SLA_HOURS,
  feedbackCode,
  feedbackReplySchema,
  feedbackSchema,
  fieldErrors,
  PERMISSIONS,
} from "@khotl/core";
import { prisma } from "@khotl/db";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import type { z } from "zod";
import { serverEnv } from "@/lib/env";
import { hashedIp } from "@/lib/request";
import { can, getCurrentUser } from "@/lib/session";
import type { ActionResult } from "./upload";

/** Thư gửi đi không được làm hỏng thao tác chính: lỗi SMTP chỉ ghi log. */
async function sendQuietly(to: string, subject: string, text: string) {
  try {
    await getMailer().send({ to, subject, text });
  } catch (error) {
    console.error(JSON.stringify({ level: "error", message: "feedback mail failed", to, error: String(error) }));
  }
}

/** Gửi góp ý, báo lỗi. Ai cũng gửi được (khách cần email); trả mã phiếu để tra cứu. */
export async function submitFeedback(
  input: z.input<typeof feedbackSchema>,
): Promise<ActionResult<{ code: string; slaHours: number }>> {
  const t = await getTranslations("errors");
  const tf = await getTranslations("feedback");
  const user = await getCurrentUser();
  const parsed = feedbackSchema.safeParse({ ...input, email: user?.email ?? input.email });
  if (!parsed.success) return { ok: false, error: t("checkFields"), fields: fieldErrors(parsed.error) };

  const who = user ? `user:${user.id}` : `ip:${await hashedIp()}`;
  const rate = await getRateLimiter().hit(`feedback:${who}`, 5, 3600);
  if (!rate.ok) return { ok: false, error: t("tooManyRequests") };

  const list = await headers();
  const data = parsed.data;
  let code = feedbackCode();
  for (let i = 0; i < 5 && (await prisma.feedback.findUnique({ where: { code }, select: { id: true } })); i++) {
    code = feedbackCode();
  }
  await prisma.feedback.create({
    data: {
      code,
      kind: data.kind,
      subject: data.subject,
      body: data.body,
      email: data.email,
      userId: user?.id ?? null,
      pageUrl: data.pageUrl ?? null,
      userAgent: list.get("user-agent")?.slice(0, 300) ?? null,
    },
  });

  const slaHours = FEEDBACK_SLA_HOURS[data.kind];
  await sendQuietly(
    data.email,
    tf("mailReceivedSubject", { code }),
    tf("mailReceivedBody", { code, subject: data.subject, hours: slaHours, url: `${serverEnv.appUrl}/gop-y` }),
  );
  for (const admin of serverEnv.adminEmails) {
    await sendQuietly(
      admin,
      tf("mailAdminSubject", { code, subject: data.subject }),
      tf("mailAdminBody", { code, email: data.email, body: data.body, url: `${serverEnv.appUrl}/quan-tri/gop-y` }),
    );
  }
  return { ok: true, code, slaHours };
}

/** Quản trị viên trả lời phiếu (gửi email cho người gửi), có thể đóng phiếu luôn. */
export async function replyFeedback(input: z.input<typeof feedbackReplySchema>): Promise<ActionResult> {
  const t = await getTranslations("errors");
  const tf = await getTranslations("feedback");
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: t("signInRequired") };
  if (!can(user, PERMISSIONS.adminUsers)) return { ok: false, error: t("forbidden") };
  const parsed = feedbackReplySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: t("checkFields"), fields: fieldErrors(parsed.error) };

  const item = await prisma.feedback.findUnique({ where: { id: parsed.data.id } });
  if (!item) return { ok: false, error: t("notFound") };
  const now = new Date();
  await prisma.$transaction([
    prisma.feedback.update({
      where: { id: item.id },
      data: {
        reply: parsed.data.reply,
        respondedById: user.id,
        respondedAt: now,
        status: parsed.data.close ? "CLOSED" : "ANSWERED",
        closedAt: parsed.data.close ? now : null,
      },
    }),
    prisma.auditLog.create({
      data: { actorId: user.id, action: "feedback.reply", entityType: "Feedback", entityId: item.id, after: { code: item.code, status: parsed.data.close ? "CLOSED" : "ANSWERED" } },
    }),
  ]);
  await sendQuietly(
    item.email,
    tf("mailReplySubject", { code: item.code }),
    tf("mailReplyBody", { code: item.code, subject: item.subject, reply: parsed.data.reply }),
  );
  return { ok: true };
}

/** Đóng hoặc mở lại phiếu mà không trả lời. */
export async function setFeedbackStatus(id: string, status: "OPEN" | "CLOSED"): Promise<ActionResult> {
  const t = await getTranslations("errors");
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: t("signInRequired") };
  if (!can(user, PERMISSIONS.adminUsers)) return { ok: false, error: t("forbidden") };
  const item = await prisma.feedback.findUnique({ where: { id }, select: { id: true, code: true } });
  if (!item) return { ok: false, error: t("notFound") };
  await prisma.$transaction([
    prisma.feedback.update({ where: { id }, data: { status, closedAt: status === "CLOSED" ? new Date() : null } }),
    prisma.auditLog.create({
      data: { actorId: user.id, action: `feedback.${status.toLowerCase()}`, entityType: "Feedback", entityId: id, after: { code: item.code, status } },
    }),
  ]);
  return { ok: true };
}
