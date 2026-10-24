import { formatDateTime, isStaff } from "@khotl/core";
import { prisma } from "@khotl/db";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { HowToEarn } from "@/components/credits/how-to-earn";
import { Pagination } from "@/components/ui/pagination";
import { Cell, EmptyState, PageHeader, TitleBlock } from "@/components/ui/title-block";
import { currentLocale } from "@/lib/locale";
import { requireUser } from "@/lib/session";
import { cn } from "@/lib/utils";
import { getCreditSettings, getCreditStatus } from "@/server/credits/ledger";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("credits");
  return { title: t("historyTitle"), robots: { index: false } };
}

const PAGE_SIZE = 50;

/** Lịch sử lượt tải: số dư hiện tại và từng giao dịch cộng/trừ. */
export default async function CreditHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await requireUser("/luot-tai");
  const t = await getTranslations("credits");
  const locale = await currentLocale();
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const now = new Date();
  const [status, settings, entries, total] = await Promise.all([
    getCreditStatus(user.id, now),
    getCreditSettings(),
    prisma.creditLedger.findMany({
      where: { userId: user.id },
      orderBy: { id: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { document: { select: { slug: true, title: true } } },
    }),
    prisma.creditLedger.count({ where: { userId: user.id } }),
  ]);

  return (
    <>
      <PageHeader title={t("historyTitle")}>
        {isStaff(user) ? (
          <p role="status" className="border-2 border-ink bg-sheet px-3 py-2 text-sm font-semibold">
            {t("staffUnlimited")}
          </p>
        ) : null}
        <TitleBlock className="grid-cols-2 md:grid-cols-4">
          <Cell label={t("todayFree")}>
            <span className="font-code text-3xl">
              {status.freeLeft}/{status.dailyFree}
            </span>
          </Cell>
          <Cell label={t("bonusLabel")}>
            <span className="font-code text-3xl text-stamp">{status.bonus}</span>
          </Cell>
          <Cell label={t("resetAt")}>{formatDateTime(status.nextReset, locale)}</Cell>
          <Cell label={status.debt > 0 ? t("debt") : t("expiring")}>
            {status.debt > 0
              ? `${status.debt}`
              : status.expiringSoon
                ? t("expiringValue", {
                    amount: status.expiringSoon.amount,
                    date: formatDateTime(status.expiringSoon.at, locale),
                  })
                : t("none")}
          </Cell>
        </TitleBlock>
        {status.debt > 0 ? <p className="text-[13px] text-pencil">{t("debtHint")}</p> : null}
        {status.rewardsLocked ? (
          <p role="status" className="border-2 border-stamp bg-sheet px-3 py-2 text-sm">
            {t("locked", { reason: status.rewardsLockReason ?? "" })}
          </p>
        ) : null}
      </PageHeader>

      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6">
        <HowToEarn settings={settings} />

        {entries.length === 0 ? (
          <EmptyState title={t("empty")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-2 border-ink bg-sheet text-sm">
              <thead className="bg-ink text-left text-paper">
                <tr>
                  <th className="px-3 py-2 font-head font-normal">{t("colTime")}</th>
                  <th className="px-3 py-2 font-head font-normal">{t("colType")}</th>
                  <th className="px-3 py-2 text-right font-head font-normal">{t("colAmount")}</th>
                  <th className="px-3 py-2 font-head font-normal">{t("colNote")}</th>
                  <th className="px-3 py-2 font-head font-normal">{t("colExpires")}</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id.toString()} className="border-t border-grid align-top">
                    <td className="whitespace-nowrap px-3 py-2 text-pencil">{formatDateTime(entry.createdAt, locale)}</td>
                    <td className="whitespace-nowrap px-3 py-2">{t(`types.${entry.type}` as "types.DAILY")}</td>
                    <td
                      className={cn(
                        "px-3 py-2 text-right font-code text-base",
                        entry.amount > 0 && "text-stamp",
                        entry.amount === 0 && "text-pencil",
                      )}
                    >
                      {entry.amount > 0 ? `+${entry.amount}` : entry.amount}
                    </td>
                    <td className="px-3 py-2">
                      {entry.note}
                      {entry.document ? (
                        <>
                          {" "}
                          <Link href={`/tai-lieu/${entry.document.slug}`} className="underline">
                            {entry.document.title}
                          </Link>
                        </>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-pencil">
                      {entry.amount > 0 && entry.expiresAt ? formatDateTime(entry.expiresAt, locale) : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} totalPages={Math.ceil(total / PAGE_SIZE)} basePath="/luot-tai" params={{}} />
      </div>
    </>
  );
}
