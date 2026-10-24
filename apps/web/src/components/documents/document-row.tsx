import { type DocumentTypeKey, documentTypeLabel, formatCount, formatRating } from "@khotl/core";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { currentLocale } from "@/lib/locale";
import { Highlighted } from "./highlighted";

export interface DocumentRowData {
  slug: string;
  title: string;
  type: string;
  term: string | null;
  courseCode: string;
  downloadCount: number;
  ratingCount: number;
  ratingSum: number;
  fileKind?: string | null;
  pageCount?: number | null;
  snippet?: string | null;
}

/**
 * Một tài liệu dạng khung tên: hàng trên là tiêu đề, cột phải là mã học phần cỡ lớn,
 * hàng dưới là các ô thông số (loại, kỳ, lượt tải, điểm).
 */
export async function DocumentRow({
  doc,
  terms = [],
  showCourse = true,
}: {
  doc: DocumentRowData;
  terms?: readonly string[];
  showCourse?: boolean;
}) {
  const t = await getTranslations("doc");
  const locale = await currentLocale();
  const rating = doc.ratingCount > 0 ? `${formatRating(doc.ratingSum / doc.ratingCount, locale)}/5` : "–";

  return (
    <Link
      href={`/tai-lieu/${doc.slug}`}
      className="group tb grid-cols-3 hover:text-ink sm:grid-cols-[repeat(4,minmax(0,1fr))_96px]"
    >
      <span className={`col-span-3 bg-sheet px-3 py-2.5 ${showCourse ? "sm:col-span-4" : "sm:col-span-5"}`}>
        <span className="block text-[15px] font-semibold leading-snug group-hover:text-stamp">
          <Highlighted text={doc.title} terms={terms} />
        </span>
        {doc.snippet ? (
          <span className="mt-1 line-clamp-2 block text-[13px] text-pencil">
            …<Highlighted text={doc.snippet.replace(/\s+/g, " ")} terms={terms} />…
          </span>
        ) : null}
      </span>
      {showCourse ? (
        <span className="col-span-3 flex flex-col justify-end bg-sheet px-3 py-2 sm:col-span-1 sm:row-span-2 sm:col-start-5 sm:row-start-1">
          <span className="text-[11px] text-pencil">{t("courseCode")}</span>
          <span className="font-code text-[22px] leading-none">
            <Highlighted text={doc.courseCode} terms={terms} />
          </span>
        </span>
      ) : null}
      <Info label={t("type")} value={documentTypeLabel(doc.type as DocumentTypeKey, locale)} />
      <Info label={t("term")} value={doc.term ?? "–"} />
      <Info
        label={doc.fileKind ? t("file") : t("downloads")}
        value={
          doc.fileKind
            ? `${doc.fileKind}${doc.pageCount ? `, ${t("pagesCount", { count: doc.pageCount })}` : ""}`
            : formatCount(doc.downloadCount, locale)
        }
        className="hidden sm:flex"
      />
      <Info label={t("rating")} value={rating} className={showCourse ? undefined : "sm:col-span-2"} />
    </Link>
  );
}

function Info({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <span className={`flex min-w-0 flex-col bg-sheet px-3 py-1.5 ${className ?? ""}`}>
      <span className="text-[11px] text-pencil">{label}</span>
      <span className="truncate text-[13px] font-semibold">{value}</span>
    </span>
  );
}
