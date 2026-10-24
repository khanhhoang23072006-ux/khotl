import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { CreditStatus } from "@/server/credits/ledger";

/**
 * Thanh lượt tải ở header. Màn hình rộng: "Hôm nay còn 7/10 lượt + 12 lượt thưởng";
 * màn hình hẹp chỉ hiện "7/10 +12". Viền đỏ khi đã hết cả hai loại lượt.
 */
export async function CreditMeter({ status, unlimited = false }: { status: CreditStatus; unlimited?: boolean }) {
  const t = await getTranslations("credits");
  if (unlimited) {
    return (
      <Link
        href="/luot-tai"
        aria-label={t("unlimitedLabel")}
        className="mr-1 flex h-9 items-center gap-1.5 border-2 border-ink px-2 text-[13px] leading-none hover:bg-wash hover:text-ink"
      >
        <span aria-hidden className="font-code text-[17px] xl:hidden">
          ∞
        </span>
        <span aria-hidden className="hidden xl:inline">
          {t("unlimited")}
        </span>
      </Link>
    );
  }
  const empty = status.freeLeft === 0 && status.bonus === 0;
  return (
    <Link
      href="/luot-tai"
      aria-label={t("meterLabel", { free: status.freeLeft, daily: status.dailyFree, bonus: status.bonus })}
      className={`mr-1 flex h-9 items-center gap-1.5 border-2 px-2 text-[13px] leading-none hover:bg-wash hover:text-ink ${
        empty ? "border-stamp text-stamp" : "border-ink"
      }`}
    >
      <span aria-hidden className="font-code text-[15px] xl:hidden">
        {status.freeLeft}/{status.dailyFree}
        {status.bonus > 0 ? <span className="text-stamp"> +{status.bonus}</span> : null}
      </span>
      <span aria-hidden className="hidden xl:inline">
        {t("meter", { free: status.freeLeft, daily: status.dailyFree })}
        {status.bonus > 0 ? <span className="text-stamp"> {t("meterBonus", { bonus: status.bonus })}</span> : null}
      </span>
    </Link>
  );
}
