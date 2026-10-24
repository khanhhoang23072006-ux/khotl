import { formatDateTime } from "@khotl/core";
import { prisma } from "@khotl/db";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AdjustCreditsForm, CreditSettingsForm, UnlockRewardsButton } from "@/components/admin/credit-forms";
import { Cell, SectionHeading, TitleBlock } from "@/components/ui/title-block";
import { currentLocale } from "@/lib/locale";
import { getCreditSettings } from "@/server/credits/ledger";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("credits.admin");
  return { title: t("tab"), robots: { index: false } };
}

/** Quản trị hạn mức tải: cấu hình, thống kê 7 ngày, tài khoản bị khóa thưởng, điều chỉnh tay. */
export default async function AdminCreditsPage() {
  const t = await getTranslations("credits.admin");
  const locale = await currentLocale();
  const since = new Date(Date.now() - 7 * 86_400_000);
  const [settings, charges, granted, revoked, lockedUsers, top] = await Promise.all([
    getCreditSettings(),
    prisma.downloadLog.groupBy({ by: ["charge"], where: { createdAt: { gte: since } }, _count: { _all: true } }),
    prisma.creditLedger.aggregate({
      where: { createdAt: { gte: since }, amount: { gt: 0 }, type: { in: ["UPLOAD_REWARD", "BONUS"] } },
      _sum: { amount: true },
    }),
    prisma.creditLedger.aggregate({
      where: { createdAt: { gte: since }, type: "REVOKE" },
      _sum: { amount: true },
    }),
    prisma.user.findMany({
      where: { rewardsLockedAt: { not: null } },
      orderBy: { rewardsLockedAt: "desc" },
      take: 50,
      select: { id: true, email: true, name: true, displayName: true, rewardsLockedAt: true, rewardsLockReason: true },
    }),
    prisma.creditLedger.groupBy({
      by: ["userId"],
      where: { createdAt: { gte: since }, amount: { gt: 0 }, type: { in: ["UPLOAD_REWARD", "BONUS"] } },
      _sum: { amount: true },
      orderBy: { _sum: { amount: "desc" } },
      take: 10,
    }),
  ]);
  const count = (charge: string) => charges.find((row) => row.charge === charge)?._count._all ?? 0;
  const topUsers = await prisma.user.findMany({
    where: { id: { in: top.map((row) => row.userId) } },
    select: { id: true, email: true, name: true, displayName: true },
  });

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <SectionHeading>{t("statsTitle")}</SectionHeading>
        <TitleBlock className="grid-cols-2 md:grid-cols-6">
          <Cell label={t("statFree")}>
            <span className="font-code text-2xl">{count("FREE")}</span>
          </Cell>
          <Cell label={t("statBonus")}>
            <span className="font-code text-2xl">{count("BONUS")}</span>
          </Cell>
          <Cell label={t("statRepeat")}>
            <span className="font-code text-2xl">{count("REPEAT")}</span>
          </Cell>
          <Cell label={t("statGranted")}>
            <span className="font-code text-2xl text-stamp">{granted._sum.amount ?? 0}</span>
          </Cell>
          <Cell label={t("statRevoked")}>
            <span className="font-code text-2xl">{Math.abs(revoked._sum.amount ?? 0)}</span>
          </Cell>
          <Cell label={t("statLocked")}>
            <span className="font-code text-2xl">{lockedUsers.length}</span>
          </Cell>
        </TitleBlock>
      </section>

      <section className="flex flex-col gap-3">
        <SectionHeading>{t("settingsTitle")}</SectionHeading>
        <CreditSettingsForm settings={settings} />
      </section>

      <section className="flex flex-col gap-3">
        <SectionHeading>{t("adjustTitle")}</SectionHeading>
        <AdjustCreditsForm />
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="flex flex-col gap-3">
          <SectionHeading>{t("topEarners")}</SectionHeading>
          {top.length === 0 ? (
            <p className="text-sm text-pencil">{t("noData")}</p>
          ) : (
            <ul className="tb grid-cols-1">
              {top.map((row) => {
                const person = topUsers.find((u) => u.id === row.userId);
                return (
                  <li key={row.userId} className="flex items-center justify-between gap-3 bg-sheet px-3 py-2 text-sm">
                    <span className="min-w-0 truncate">{person ? `${person.displayName || person.name} (${person.email})` : row.userId}</span>
                    <span className="font-code text-lg text-stamp">+{row._sum.amount ?? 0}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        <section className="flex flex-col gap-3">
          <SectionHeading>{t("lockedTitle")}</SectionHeading>
          {lockedUsers.length === 0 ? (
            <p className="text-sm text-pencil">{t("noData")}</p>
          ) : (
            <ul className="tb grid-cols-1">
              {lockedUsers.map((person) => (
                <li key={person.id} className="flex items-center justify-between gap-3 bg-sheet px-3 py-2 text-sm">
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-semibold">
                      {person.displayName || person.name} ({person.email})
                    </span>
                    <span className="text-[12px] text-pencil">
                      {person.rewardsLockReason}
                      {person.rewardsLockedAt ? `, ${formatDateTime(person.rewardsLockedAt, locale)}` : ""}
                    </span>
                  </span>
                  <UnlockRewardsButton userId={person.id} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
