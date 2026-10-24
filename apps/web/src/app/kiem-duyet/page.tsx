import {
  type DocumentTypeKey,
  documentTypeLabel,
  formatBytes,
  moderationScope,
  PERMISSIONS,
  REVIEW_REASON_TEMPLATES,
  riskLevel,
} from "@khotl/core";
import { prisma } from "@khotl/db";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { type QueueItem, QueueList } from "@/components/moderation/queue-list";
import { EmptyState } from "@/components/ui/title-block";
import { currentLocale } from "@/lib/locale";
import { requirePermission } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("moderation");
  return { title: t("title"), robots: { index: false } };
}

function waitingText(createdAt: Date, locale: "vi" | "en"): string {
  const hours = Math.max(0, Math.round((Date.now() - createdAt.getTime()) / 3_600_000));
  if (locale === "en") return hours < 24 ? `Waiting ${hours}h.` : `Waiting ${Math.round(hours / 24)}d.`;
  return hours < 24 ? `Chờ ${hours} giờ.` : `Chờ ${Math.round(hours / 24)} ngày.`;
}

export default async function ModerationQueuePage() {
  const user = await requirePermission(PERMISSIONS.documentModerate, "/kiem-duyet");
  const t = await getTranslations("moderation");
  const locale = await currentLocale();
  const scope = moderationScope(user);

  const documents = await prisma.document.findMany({
    where: {
      status: "PENDING_REVIEW",
      ...(scope === null ? {} : { course: { facultyId: { in: scope } } }),
    },
    // Người đăng uy tín được xếp trước, cùng mức thì ai gửi trước duyệt trước
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    take: 100,
    select: {
      id: true,
      title: true,
      type: true,
      riskScore: true,
      createdAt: true,
      course: { select: { code: true } },
      uploader: { select: { name: true, displayName: true, trustLevel: true, approvedDocumentCount: true } },
      currentVersion: { select: { fileKind: true, sizeBytes: true, pageCount: true, checkResults: true } },
    },
  });

  const items: QueueItem[] = documents.map((doc) => {
    const content = (doc.currentVersion?.checkResults as Record<string, { reasons?: string[] }> | null)?.content;
    return {
      id: doc.id,
      title: doc.title,
      courseCode: doc.course.code,
      typeLabel: documentTypeLabel(doc.type as DocumentTypeKey, locale),
      fileLabel: doc.currentVersion
        ? `${doc.currentVersion.fileKind} ${formatBytes(Number(doc.currentVersion.sizeBytes), locale)}`
        : "–",
      uploader: doc.uploader.displayName || doc.uploader.name,
      uploaderNote:
        doc.uploader.approvedDocumentCount === 0
          ? t("newUploader")
          : t("uploaderApproved", { count: doc.uploader.approvedDocumentCount, level: doc.uploader.trustLevel }),
      riskScore: doc.riskScore,
      riskLevel: riskLevel(doc.riskScore),
      riskReasons: Array.isArray(content?.reasons) ? content.reasons.slice(0, 3) : [],
      waiting: waitingText(doc.createdAt, locale),
    };
  });

  if (items.length === 0) return <EmptyState title={t("queueEmpty")}>{t("queueEmptyHint")}</EmptyState>;
  return <QueueList items={items} templates={REVIEW_REASON_TEMPLATES[locale]} />;
}
