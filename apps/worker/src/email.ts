import { getMailer } from "@khotl/adapters";
import { prisma } from "@khotl/db";
import { config } from "./env";
import { errorMessage, log } from "./log";

interface PendingRow {
  id: string;
  type: string;
  data: unknown;
  link: string | null;
  email: string;
  name: string;
}

const EMAIL_TYPES = [
  "DOCUMENT_APPROVED",
  "DOCUMENT_REJECTED",
  "DOCUMENT_CHANGES_REQUESTED",
  "DOCUMENT_REMOVED",
] as const;

/**
 * Gửi email cho thông báo kết quả kiểm duyệt. Đánh dấu emailedAt trước khi gửi
 * (gửi tối đa một lần), nhận việc bằng SKIP LOCKED để chạy được nhiều worker.
 * Trả về true nếu có việc để làm.
 */
export async function sendPendingEmails(): Promise<boolean> {
  const rows = await prisma.$queryRaw<PendingRow[]>`
    UPDATE notifications n
    SET "emailedAt" = now()
    FROM users u
    WHERE n."userId" = u.id
      AND n.id IN (
        SELECT id FROM notifications
        WHERE "emailedAt" IS NULL
          AND type::text = ANY(${EMAIL_TYPES as unknown as string[]})
          AND "createdAt" > now() - interval '2 days'
        ORDER BY "createdAt"
        LIMIT 20
        FOR UPDATE SKIP LOCKED
      )
    RETURNING n.id, n.type::text AS type, n.data, n.link, u.email, u.name`;

  for (const row of rows) {
    const message = buildMessage(row);
    if (!message) continue;
    try {
      await getMailer().send({ to: row.email, ...message });
    } catch (error) {
      log.warn("Gửi email thất bại", { notificationId: row.id, error: errorMessage(error) });
    }
  }
  return rows.length > 0;
}

function buildMessage(row: PendingRow): { subject: string; text: string } | null {
  const data = (row.data ?? {}) as { title?: string; reason?: string };
  const title = data.title ?? "tài liệu của bạn";
  const link = `${config.appUrl}${row.link ?? "/tai-lieu-cua-toi"}`;
  const greeting = `Chào ${row.name || "bạn"},`;
  const footer = "\n\nKho tài liệu HUST\nBạn nhận email này vì đã đăng tài liệu lên Kho tài liệu HUST.";

  switch (row.type) {
    case "DOCUMENT_APPROVED":
      return {
        subject: `Tài liệu đã được duyệt: ${title}`,
        text: `${greeting}\n\n“${title}” đã được duyệt và hiển thị công khai.\nXem tại: ${link}${footer}`,
      };
    case "DOCUMENT_REJECTED":
      return {
        subject: `Tài liệu chưa được duyệt: ${title}`,
        text: `${greeting}\n\n“${title}” chưa được duyệt.\nLý do: ${data.reason ?? "không nêu"}\nXem chi tiết: ${link}${footer}`,
      };
    case "DOCUMENT_CHANGES_REQUESTED":
      return {
        subject: `Cần chỉnh sửa tài liệu: ${title}`,
        text: `${greeting}\n\nKiểm duyệt viên đề nghị bạn chỉnh sửa “${title}” trước khi công khai.\nGhi chú: ${data.reason ?? "không nêu"}\nSửa tại: ${link}${footer}`,
      };
    case "DOCUMENT_REMOVED":
      return {
        subject: `Tài liệu đã bị gỡ: ${title}`,
        text: `${greeting}\n\n“${title}” đã bị gỡ khỏi kho.\nLý do: ${data.reason ?? "không nêu"}${footer}`,
      };
    default:
      return null;
  }
}
