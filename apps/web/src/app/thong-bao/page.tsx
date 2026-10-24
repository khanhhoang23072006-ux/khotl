import { formatDateTime } from "@khotl/core";
import { prisma } from "@khotl/db";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { MarkAllRead } from "@/components/account/mark-all-read";
import { EmptyState, PageHeader } from "@/components/ui/title-block";
import { currentLocale } from "@/lib/locale";
import { requireUser } from "@/lib/session";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("notifications");
  return { title: t("title"), robots: { index: false } };
}

export default async function NotificationsPage() {
  const user = await requireUser("/thong-bao");
  const t = await getTranslations("notifications");
  const tc = await getTranslations("credits");
  const locale = await currentLocale();
  const items = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const unread = items.some((item) => !item.readAt);

  return (
    <>
      <PageHeader title={t("title")}>{unread ? <MarkAllRead /> : null}</PageHeader>
      <div className="mx-auto max-w-3xl px-4 py-6">
        {items.length === 0 ? (
          <EmptyState title={t("empty")} />
        ) : (
          <ul className="tb grid-cols-1">
            {items.map((item) => {
              const data = (item.data ?? {}) as { title?: string; reason?: string; credits?: number; amount?: number };
              const body = (
                <>
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="font-semibold">
                      {t(`types.${item.type}` as "types.SYSTEM", { title: data.title ?? "" })}
                    </span>
                    <span className="shrink-0 text-[12px] text-pencil">{formatDateTime(item.createdAt, locale)}</span>
                  </span>
                  {data.reason ? <span className="text-sm">{t("reason", { reason: data.reason })}</span> : null}
                  {data.credits ? (
                    <span className="font-code text-base text-stamp">{tc("approvedCredits", { amount: data.credits })}</span>
                  ) : null}
                  {typeof data.amount === "number" ? (
                    <span className="font-code text-base">{tc("changedAmount", { amount: data.amount })}</span>
                  ) : null}
                </>
              );
              const className = cn(
                "flex flex-col gap-0.5 px-3 py-2.5",
                item.readAt ? "bg-paper" : "border-l-4 border-stamp bg-sheet",
              );
              return (
                <li key={item.id} className="bg-sheet">
                  {item.link ? (
                    <Link href={item.link} className={cn(className, "hover:bg-wash hover:text-ink")}>
                      {body}
                    </Link>
                  ) : (
                    <div className={className}>{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
