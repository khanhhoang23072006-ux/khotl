import {
  can,
  type DocumentTypeKey,
  describeTerm,
  documentTypeLabel,
  formatBytes,
  formatCount,
  formatDate,
  formatDateTime,
  formatRating,
  PERMISSIONS,
  vietnamDay,
} from "@khotl/core";
import { prisma } from "@khotl/db";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { getTranslations } from "next-intl/server";
import { DocumentRow } from "@/components/documents/document-row";
import { PdfViewer } from "@/components/documents/pdf-viewer";
import { RemoveForm } from "@/components/documents/remove-form";
import { ReportForm } from "@/components/documents/report-form";
import { StatusBadge } from "@/components/documents/status-badge";
import { OutOfCreditsDialog } from "@/components/credits/out-of-credits";
import { DownloadIcon } from "@/components/icons";
import { buttonVariants } from "@/components/ui/button";
import { Cell } from "@/components/ui/title-block";
import { serverEnv } from "@/lib/env";
import { currentLocale } from "@/lib/locale";
import { documentAccess } from "@/lib/policies";
import { documentRowSelect, PUBLIC_DOCUMENT, toRow } from "@/lib/queries";
import { getCurrentUser } from "@/lib/session";
import { initials } from "@/lib/utils";
import { previewCharge } from "@/server/credits/ledger";

type Params = Promise<{ slug: string }>;

async function getDocument(slug: string) {
  return prisma.document.findUnique({
    where: { slug },
    include: {
      course: { include: { faculty: { select: { slug: true, shortName: true, name: true } } } },
      uploader: { select: { id: true, name: true, displayName: true, username: true, approvedDocumentCount: true } },
      currentVersion: true,
      tags: { include: { tag: true }, orderBy: { source: "asc" } },
    },
  });
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const doc = await getDocument((await params).slug);
  if (!doc || documentAccess(doc, null) !== "public") return { robots: { index: false } };
  return {
    title: doc.title,
    description: doc.description ?? `${doc.course.code} ${doc.course.name}`,
    openGraph: { title: doc.title, type: "article" },
  };
}

export default async function DocumentPage({ params }: { params: Params }) {
  const { slug } = await params;
  const doc = await getDocument(slug);
  if (!doc) notFound();
  const user = await getCurrentUser();
  const access = documentAccess(doc, user);
  if (!access) notFound();

  const t = await getTranslations("doc");
  const locale = await currentLocale();
  const version = doc.currentVersion;
  const isModerator = user ? can(user, PERMISSIONS.documentModerate, { facultyId: doc.course.facultyId }) : false;
  // Người đăng ẩn danh: công chúng không thấy tên, người đăng và kiểm duyệt viên vẫn thấy
  const showUploader = !doc.isAnonymous || access !== "public" || isModerator;
  const uploaderName = doc.uploader.displayName || doc.uploader.name;

  const related = await prisma.document.findMany({
    where: { ...PUBLIC_DOCUMENT, courseId: doc.courseId, NOT: { id: doc.id } },
    orderBy: [{ downloadCount: "desc" }],
    take: 4,
    select: documentRowSelect,
  });

  if (access === "public" && user?.id !== doc.uploaderId) {
    after(async () => {
      const day = vietnamDay();
      await prisma.$transaction([
        prisma.document.update({ where: { id: doc.id }, data: { viewCount: { increment: 1 } } }),
        prisma.documentDailyStat.upsert({
          where: { documentId_date: { documentId: doc.id, date: day } },
          create: { documentId: doc.id, date: day, views: 1 },
          update: { views: { increment: 1 } },
        }),
      ]);
    });
  }

  // Lần tải tới sẽ tính lượt thế nào (người đăng, kiểm duyệt viên, tài liệu chưa công khai: không tính)
  const exempt = access !== "public" || user?.id === doc.uploaderId || doc.status !== "APPROVED";
  const charge = user && version && !exempt ? await previewCharge(user.id, doc.id) : null;
  const tc = await getTranslations("credits");
  const downloadNote = !user
    ? null
    : exempt
      ? tc("exemptFree")
      : charge?.decision === "REPEAT"
        ? tc("repeatFree", { hours: charge.settings.redownloadWindowHours })
        : charge?.decision === "FREE"
          ? tc("willUseFree", { free: charge.status.freeLeft, daily: charge.status.dailyFree })
          : charge?.decision === "BONUS"
            ? tc("willUseBonus", { bonus: charge.status.bonus })
            : null;
  const previewPages = version ? version.previewImageKeys.length : 0;
  const guestPages = Math.min(previewPages, serverEnv.guestPreviewPages);
  const rating = doc.ratingCount > 0 ? `${formatRating(doc.ratingSum / doc.ratingCount, locale)}/5 (${doc.ratingCount})` : "–";
  const processing = version && version.processingStatus !== "DONE" && version.processingStatus !== "FAILED";

  return (
    <div className="mx-auto max-w-6xl px-4 py-5">
      <nav aria-label={t("breadcrumb")} className="mb-3 flex flex-wrap gap-x-2 text-[13px] text-pencil">
        <Link href={`/vien/${doc.course.faculty.slug}`} className="underline">
          {doc.course.faculty.shortName ?? doc.course.faculty.name}
        </Link>
        <span aria-hidden="true">/</span>
        <Link href={`/hoc-phan/${doc.course.code}`} className="underline">
          {doc.course.code} {doc.course.name}
        </Link>
      </nav>

      {access !== "public" ? (
        <div className="mb-4 flex flex-col gap-1 border-2 border-ink bg-sheet px-3 py-2 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={doc.status} />
            <span>{t(`statusNote.${doc.status}` as "statusNote.PENDING_REVIEW")}</span>
          </div>
          {doc.reviewNote ? (
            <p>
              <span className="font-head">{t("reviewNote")}: </span>
              {doc.reviewNote}
            </p>
          ) : null}
          {isModerator && doc.status === "PENDING_REVIEW" ? (
            <Link href={`/kiem-duyet/${doc.id}`} className="font-semibold underline">
              {t("openInQueue")}
            </Link>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="order-2 flex min-w-0 flex-col gap-3 lg:order-1">
          {processing ? (
            <div className="skeleton flex aspect-[1/1.2] items-center justify-center border-2 border-ink text-sm">
              {t("processing")}
            </div>
          ) : user && version?.previewPdfKey ? (
            <PdfViewer src={`/api/tai-lieu/${doc.id}/xem`} title={doc.title} />
          ) : guestPages > 0 ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: user ? previewPages : guestPages }, (_, index) => (
                <Image
                  key={index}
                  src={`/api/tai-lieu/${doc.id}/anh/${index + 1}`}
                  alt={t("pageImage", { page: index + 1 })}
                  width={1000}
                  height={1414}
                  unoptimized
                  priority={index === 0}
                  className="h-auto w-full border-2 border-ink bg-white"
                />
              ))}
              {!user ? (
                <div className="flex flex-col items-start gap-2 border-2 border-ink bg-sheet p-4">
                  <p className="font-head">{t("guestLimit", { count: guestPages })}</p>
                  <Link
                    href={`/dang-nhap?next=${encodeURIComponent(`/tai-lieu/${doc.slug}`)}`}
                    className={buttonVariants({ variant: "ink" })}
                  >
                    {t("signInToRead")}
                  </Link>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="border-2 border-ink bg-sheet p-6 text-sm">{t("noPreview")}</div>
          )}
        </div>

        <aside className="order-1 flex flex-col gap-3 lg:order-2">
          <div className="tb grid-cols-2">
            <div className="col-span-2 bg-sheet px-3 py-3">
              <h1 className="font-head text-xl leading-tight md:text-2xl">{doc.title}</h1>
              {doc.status === "APPROVED" && doc.publishedAt ? (
                <div className="mt-2 flex items-center gap-2">
                  <span className="stamp">{t("approvedStamp")}</span>
                  <span className="text-[12px] text-pencil">{formatDate(doc.publishedAt, locale)}</span>
                </div>
              ) : null}
            </div>
            <div className="col-span-2 flex items-end justify-between bg-sheet px-3 py-2">
              <span className="flex flex-col">
                <span className="text-[11px] text-pencil">{t("courseCode")}</span>
                <Link href={`/hoc-phan/${doc.course.code}`} className="font-code text-3xl leading-none">
                  {doc.course.code}
                </Link>
              </span>
              <span className="max-w-[60%] text-right text-[13px]">{doc.course.name}</span>
            </div>
            <Cell label={t("type")}>{documentTypeLabel(doc.type as DocumentTypeKey, locale)}</Cell>
            <Cell label={t("term")}>
              {doc.term ? <span title={describeTerm(doc.term, locale)}>{doc.term}</span> : "–"}
            </Cell>
            <Cell label={t("file")}>
              {version
                ? `${version.fileKind}, ${formatBytes(Number(version.sizeBytes), locale)}${version.pageCount ? `, ${t("pagesCount", { count: version.pageCount })}` : ""}`
                : "–"}
            </Cell>
            <Cell label={t("rating")}>{rating}</Cell>
            <Cell label={t("views")}>{formatCount(doc.viewCount, locale)}</Cell>
            <Cell label={t("downloads")}>{formatCount(doc.downloadCount, locale)}</Cell>
            <div className="col-span-2 flex items-center gap-3 bg-sheet px-3 py-2">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center border-2 border-ink font-code text-sm">
                {showUploader ? initials(uploaderName) : "?"}
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-semibold">
                  {showUploader ? uploaderName : t("anonymous")}
                  {showUploader && doc.isAnonymous ? (
                    <span className="ml-1 text-[12px] font-normal text-pencil">({t("anonymousToPublic")})</span>
                  ) : null}
                </span>
                {showUploader ? (
                  <span className="text-[12px] text-pencil">
                    {t("contributed", { count: doc.uploader.approvedDocumentCount })}
                  </span>
                ) : null}
              </span>
            </div>
          </div>

          {version && charge?.decision === "DENIED" ? (
            <OutOfCreditsDialog
              label={
                <>
                  <DownloadIcon />
                  {t("download", { size: formatBytes(Number(version.sizeBytes), locale) })}
                </>
              }
              body={tc("outBody", {
                daily: charge.status.dailyFree,
                reset: formatDateTime(charge.status.nextReset, locale),
                reward: charge.settings.uploadReward,
              })}
            />
          ) : version ? (
            <a
              href={`/api/tai-lieu/${doc.id}/tai-xuong?tu=${encodeURIComponent(`/tai-lieu/${doc.slug}`)}`}
              className={buttonVariants({ variant: "primary", size: "lg", className: "w-full" })}
              rel="nofollow"
            >
              <DownloadIcon />
              {user ? t("download", { size: formatBytes(Number(version.sizeBytes), locale) }) : t("signInToDownload")}
            </a>
          ) : null}
          {version && downloadNote ? <p className="-mt-1 text-[12px] text-pencil">{downloadNote}</p> : null}

          {doc.description ? (
            <section className="border-2 border-ink bg-sheet px-3 py-2">
              <h2 className="text-[11px] text-pencil">{t("description")}</h2>
              <p className="whitespace-pre-line text-sm">{doc.description}</p>
            </section>
          ) : null}

          {doc.tags.length > 0 ? (
            <ul className="flex flex-wrap gap-1.5" aria-label={t("tags")}>
              {doc.tags.map(({ tag }) => (
                <li key={tag.id}>
                  <Link
                    href={`/tim-kiem?q=${encodeURIComponent(tag.name)}`}
                    className="inline-flex h-8 items-center border border-ink bg-sheet px-2 text-[13px] hover:bg-wash"
                  >
                    {tag.name}
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}

          {user && access === "public" ? <ReportForm documentId={doc.id} /> : null}

          {isModerator && doc.status === "APPROVED" ? (
            <section className="border-2 border-stamp bg-sheet p-3">
              <h2 className="mb-2 font-head text-sm">{t("moderatorTools")}</h2>
              <RemoveForm documentId={doc.id} />
            </section>
          ) : null}
        </aside>
      </div>

      {related.length > 0 ? (
        <section className="mt-8 flex flex-col gap-3" aria-labelledby="lien-quan">
          <h2 id="lien-quan" className="font-head text-lg">
            {t("related")}
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            {related.map((item) => (
              <DocumentRow key={item.slug} doc={toRow(item)} showCourse={false} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
