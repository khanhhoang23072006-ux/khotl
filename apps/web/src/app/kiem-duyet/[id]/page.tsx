import {
  can,
  type DocumentTypeKey,
  documentTypeLabel,
  formatBytes,
  formatDateTime,
  moderationScope,
  PERMISSIONS,
  REVIEW_REASON_TEMPLATES,
} from "@khotl/core";
import { prisma } from "@khotl/db";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PdfViewer } from "@/components/documents/pdf-viewer";
import { StatusBadge } from "@/components/documents/status-badge";
import { DecisionPanel } from "@/components/moderation/decision-panel";
import { Cell } from "@/components/ui/title-block";
import { currentLocale } from "@/lib/locale";
import { requirePermission } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { robots: { index: false } };

interface CheckEntry {
  status: "pass" | "fail" | "warn" | "skipped";
  detail?: string;
  reasons?: string[];
}

const CHECK_ORDER = ["format", "duplicate", "virus", "convert", "integrity", "text", "archive", "content"] as const;

export default async function ModerationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePermission(PERMISSIONS.documentModerate, `/kiem-duyet/${id}`);
  const doc = await prisma.document.findUnique({
    where: { id },
    include: {
      course: { select: { code: true, name: true, facultyId: true } },
      uploader: {
        select: { name: true, displayName: true, email: true, trustLevel: true, approvedDocumentCount: true, createdAt: true },
      },
      currentVersion: true,
      tags: { include: { tag: true } },
      moderationLogs: {
        orderBy: { createdAt: "desc" },
        take: 30,
        include: { actor: { select: { name: true, displayName: true } } },
      },
    },
  });
  if (!doc || !can(user, PERMISSIONS.documentModerate, { facultyId: doc.course.facultyId })) notFound();

  const t = await getTranslations("moderation");
  const td = await getTranslations("doc");
  const locale = await currentLocale();
  const version = doc.currentVersion;
  const checks = (version?.checkResults ?? {}) as unknown as Record<string, CheckEntry>;
  const scope = moderationScope(user);
  const next = await prisma.document.findFirst({
    where: {
      status: "PENDING_REVIEW",
      id: { not: doc.id },
      ...(scope === null ? {} : { course: { facultyId: { in: scope } } }),
    },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    select: { id: true },
  });
  const nextHref = next ? `/kiem-duyet/${next.id}` : "/kiem-duyet";

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_400px]">
      <div className="flex min-w-0 flex-col gap-3">
        <Link href="/kiem-duyet" className="text-[13px] underline">
          {t("backToQueue")}
        </Link>
        {version?.previewPdfKey ? (
          <PdfViewer src={`/api/tai-lieu/${doc.id}/xem`} title={doc.title} />
        ) : version && version.previewImageKeys.length > 0 ? (
          version.previewImageKeys.map((_, index) => (
            <Image
              key={index}
              src={`/api/tai-lieu/${doc.id}/anh/${index + 1}`}
              alt={td("pageImage", { page: index + 1 })}
              width={1000}
              height={1414}
              unoptimized
              className="h-auto w-full border-2 border-ink bg-white"
            />
          ))
        ) : (
          <div className="border-2 border-ink bg-sheet p-6 text-sm">{td("noPreview")}</div>
        )}
      </div>

      <aside className="flex flex-col gap-4">
        <div className="tb grid-cols-2">
          <div className="col-span-2 bg-sheet px-3 py-3">
            <div className="mb-1">
              <StatusBadge status={doc.status} />
            </div>
            <h2 className="font-head text-xl leading-tight">{doc.title}</h2>
            {doc.description ? <p className="mt-1 whitespace-pre-line text-sm">{doc.description}</p> : null}
          </div>
          <Cell label={t("uploader")} className="col-span-2">
            {doc.uploader.displayName || doc.uploader.name} ({doc.uploader.email})
            {doc.isAnonymous ? <span className="ml-1 text-stamp">{t("anonymousFlag")}</span> : null}
            <span className="block text-[12px] font-normal text-pencil">
              {t("uploaderApproved", { count: doc.uploader.approvedDocumentCount, level: doc.uploader.trustLevel })}
            </span>
          </Cell>
          <Cell label={td("courseCode")}>
            {doc.course.code} {doc.course.name}
          </Cell>
          <Cell label={td("type")}>
            {documentTypeLabel(doc.type as DocumentTypeKey, locale)}
            {doc.term ? `, ${doc.term}` : ""}
          </Cell>
          <Cell label={td("file")} className="col-span-2">
            {version
              ? `${version.originalName}, ${formatBytes(Number(version.sizeBytes), locale)}, ${t("version", { number: version.versionNumber })}`
              : "–"}
          </Cell>
          {doc.tags.length > 0 ? (
            <Cell label={td("tags")} className="col-span-2">
              {doc.tags.map(({ tag }) => tag.name).join(", ")}
            </Cell>
          ) : null}
        </div>

        <section>
          <h3 className="mb-1 font-head text-sm">{t("autoChecks")}</h3>
          <table className="w-full border-collapse border-2 border-ink bg-sheet text-[13px]">
            <tbody>
              {CHECK_ORDER.filter((key) => checks[key]).map((key) => {
                const check = checks[key] as CheckEntry;
                return (
                  <tr key={key}>
                    <th scope="row" className="w-28 border border-ink px-2 py-1.5 text-left font-medium">
                      {t(`checks.${key}`)}
                    </th>
                    <td className="border border-ink px-2 py-1.5">
                      {check.detail ?? ""}
                      {check.reasons?.length ? (
                        <span className="block text-stamp">{check.reasons.join("; ")}</span>
                      ) : null}
                    </td>
                    <td
                      className={cn(
                        "w-20 border border-ink px-2 py-1.5 text-center font-head",
                        check.status === "fail" && "bg-stamp text-stamp-ink",
                        check.status === "warn" && "bg-ink text-paper",
                      )}
                    >
                      {t(`checkStatus.${check.status}`)}
                    </td>
                  </tr>
                );
              })}
              <tr>
                <th scope="row" className="border border-ink px-2 py-1.5 text-left font-medium">
                  {t("riskScore")}
                </th>
                <td colSpan={2} className="border border-ink px-2 py-1.5 font-head">
                  {doc.riskScore}/100
                </td>
              </tr>
            </tbody>
          </table>
          {version?.processingError ? (
            <p className="mt-1 text-[12px] text-stamp">{version.processingError}</p>
          ) : null}
        </section>

        {doc.status === "PENDING_REVIEW" ? (
          <section className="flex flex-col gap-2">
            <h3 className="font-head text-sm">{t("decision")}</h3>
            <DecisionPanel documentIds={[doc.id]} templates={REVIEW_REASON_TEMPLATES[locale]} nextHref={nextHref} />
          </section>
        ) : null}

        <section>
          <h3 className="mb-1 font-head text-sm">{t("history")}</h3>
          <ol className="flex flex-col border-2 border-ink bg-sheet text-[13px]">
            {doc.moderationLogs.map((log) => (
              <li key={log.id} className="border-b border-grid px-3 py-1.5 last:border-b-0">
                <span className="text-pencil">{formatDateTime(log.createdAt, locale)} </span>
                <span className="font-semibold">
                  {log.actor ? log.actor.displayName || log.actor.name : t("system")}
                </span>{" "}
                {t(`actions.${log.action}` as "actions.NOTE")}
                {log.reason ? <span className="block">{log.reason}</span> : null}
                {log.internalNote ? <span className="block text-pencil">{log.internalNote}</span> : null}
              </li>
            ))}
            <li className="px-3 py-1.5">
              <span className="text-pencil">{formatDateTime(doc.createdAt, locale)} </span>
              {t("submitted")}
            </li>
          </ol>
        </section>
      </aside>
    </div>
  );
}
