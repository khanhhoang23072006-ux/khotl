import { formatDateTime, moderationScope, PERMISSIONS, type ReportReasonKey, reportReasonLabel } from "@khotl/core";
import { prisma } from "@khotl/db";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { RemoveForm } from "@/components/documents/remove-form";
import { StatusBadge } from "@/components/documents/status-badge";
import { DismissButton } from "@/components/moderation/dismiss-button";
import { EmptyState } from "@/components/ui/title-block";
import { currentLocale } from "@/lib/locale";
import { requirePermission } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("moderation");
  return { title: t("reportsTab"), robots: { index: false } };
}

export default async function ReportsPage() {
  const user = await requirePermission(PERMISSIONS.reportResolve, "/kiem-duyet/bao-cao");
  const t = await getTranslations("moderation");
  const locale = await currentLocale();
  const scope = moderationScope(user);

  const reports = await prisma.report.findMany({
    where: {
      status: { in: ["OPEN", "IN_REVIEW"] },
      targetType: "DOCUMENT",
      ...(scope === null ? {} : { document: { course: { facultyId: { in: scope } } } }),
    },
    orderBy: { createdAt: "asc" },
    take: 100,
    include: {
      reporter: { select: { name: true, email: true } },
      document: { select: { id: true, slug: true, title: true, status: true, course: { select: { code: true } } } },
    },
  });

  if (reports.length === 0) return <EmptyState title={t("reportsEmpty")} />;

  return (
    <ul className="flex flex-col gap-3">
      {reports.map((report) => {
        const evidence = (report.evidence ?? {}) as { takedown?: boolean; fullName?: string };
        return (
          <li key={report.id} className="tb grid-cols-1 md:grid-cols-[1fr_280px]">
            <div className="flex flex-col gap-1.5 bg-sheet px-3 py-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className={evidence.takedown ? "stamp" : "border-2 border-ink px-2 font-head text-[12px]"}>
                  {evidence.takedown ? t("takedownStamp") : reportReasonLabel(report.reason as ReportReasonKey, locale)}
                </span>
                <span className="text-[12px] text-pencil">{formatDateTime(report.createdAt, locale)}</span>
              </div>
              {report.document ? (
                <p className="flex flex-wrap items-center gap-2">
                  <span className="font-head">{report.document.course.code}</span>
                  <Link href={`/tai-lieu/${report.document.slug}`} className="font-semibold underline">
                    {report.document.title}
                  </Link>
                  <StatusBadge status={report.document.status} />
                </p>
              ) : null}
              {report.details ? <p className="whitespace-pre-line text-sm">{report.details}</p> : null}
              <p className="text-[12px] text-pencil">
                {t("reportedBy")}:{" "}
                {report.reporter
                  ? `${report.reporter.name} (${report.reporter.email})`
                  : `${evidence.fullName ?? ""} (${report.reporterEmail ?? ""})`}
              </p>
            </div>
            <div className="flex flex-col gap-3 bg-sheet px-3 py-2.5">
              {report.document && report.document.status !== "REMOVED" ? (
                <RemoveForm documentId={report.document.id} reportId={report.id} />
              ) : null}
              <DismissButton reportId={report.id} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
