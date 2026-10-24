import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { cn } from "@/lib/utils";

/** Phân trang bằng liên kết (giữ nguyên các tham số lọc khác trên URL). */
export async function Pagination({
  page,
  totalPages,
  basePath,
  params,
}: {
  page: number;
  totalPages: number;
  basePath: string;
  params: Record<string, string | undefined>;
}) {
  if (totalPages <= 1) return null;
  const t = await getTranslations("common");
  const href = (target: number) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) if (value) search.set(key, value);
    if (target > 1) search.set("page", String(target));
    const query = search.toString();
    return query ? `${basePath}?${query}` : basePath;
  };
  const cell = "flex h-11 min-w-11 items-center justify-center bg-sheet px-3 font-head text-sm";
  return (
    <nav aria-label={t("pagination")} className="tb w-fit grid-flow-col">
      {page > 1 ? (
        <Link href={href(page - 1)} className={cell} rel="prev">
          {t("previous")}
        </Link>
      ) : (
        <span className={cn(cell, "text-pencil")}>{t("previous")}</span>
      )}
      <span className={cn(cell, "bg-ink text-paper")} aria-current="page">
        {t("pageOf", { page, total: totalPages })}
      </span>
      {page < totalPages ? (
        <Link href={href(page + 1)} className={cell} rel="next">
          {t("next")}
        </Link>
      ) : (
        <span className={cn(cell, "text-pencil")}>{t("next")}</span>
      )}
    </nav>
  );
}
