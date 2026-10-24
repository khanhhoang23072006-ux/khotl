import type { CreditSettings } from "@khotl/core";
import { getTranslations } from "next-intl/server";

/** Quy tắc kiếm lượt thưởng và cách tính lượt, đọc từ cấu hình hiện tại. */
export async function HowToEarn({ settings }: { settings: CreditSettings }) {
  const t = await getTranslations("credits");
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <section className="border-2 border-ink bg-sheet px-4 py-3">
        <h2 className="font-head text-lg">{t("howTitle")}</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
          <li>{t("howUpload", { amount: settings.uploadReward })}</li>
          <li>{t("howMilestone", { every: settings.milestoneEvery, amount: settings.milestoneReward })}</li>
          <li>{t("howScarce", { threshold: settings.scarceCourseThreshold, amount: settings.scarceCourseBonus })}</li>
          <li>{t("howComment", { likes: settings.helpfulCommentLikes, amount: settings.helpfulCommentReward })}</li>
        </ul>
        <p className="mt-2 text-[13px] text-pencil">
          {t("howRules", { cap: settings.dailyEarnCap, days: settings.creditTtlDays })}
        </p>
      </section>
      <section className="border-2 border-ink bg-sheet px-4 py-3">
        <h2 className="font-head text-lg">{t("countTitle")}</h2>
        <p className="mt-2 text-sm">{t("countRules", { hours: settings.redownloadWindowHours })}</p>
      </section>
    </div>
  );
}
