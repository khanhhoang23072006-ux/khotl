import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LocaleSwitch } from "./locale-switch";
import { ThemeToggle } from "./theme-toggle";

/** Chân trang dạng khung tên bản vẽ: tên công trình, đơn vị, tờ số. */
export async function SiteFooter() {
  const t = await getTranslations("footer");
  return (
    <footer className="mt-12 border-t-2 border-ink pb-[76px] md:pb-0">
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="tb grid-cols-2 text-[13px] md:grid-cols-[2fr_1fr_1fr_1fr]">
          <div className="col-span-2 bg-sheet px-3 py-2 md:col-span-1">
            <p className="text-[11px] text-pencil">{t("project")}</p>
            <p className="font-head">{t("name")}</p>
            <p className="text-pencil">{t("tagline")}</p>
          </div>
          <div className="flex flex-col bg-sheet px-3 py-2">
            <span className="text-[11px] text-pencil">{t("rules")}</span>
            <Link href="/dieu-khoan" className="underline-offset-2 hover:underline">
              {t("terms")}
            </Link>
            <Link href="/quyen-rieng-tu" className="underline-offset-2 hover:underline">
              {t("privacy")}
            </Link>
          </div>
          <div className="flex flex-col bg-sheet px-3 py-2">
            <span className="text-[11px] text-pencil">{t("copyright")}</span>
            <Link href="/go-tai-lieu" className="underline-offset-2 hover:underline">
              {t("takedown")}
            </Link>
          </div>
          <div className="col-span-2 flex items-center justify-between bg-sheet px-1 md:col-span-1">
            <span className="px-2 text-[11px] text-pencil">{t("display")}</span>
            <span className="flex">
              <LocaleSwitch />
              <ThemeToggle />
            </span>
          </div>
        </div>
        <p className="mt-3 text-[12px] text-pencil">{t("disclaimer")}</p>
      </div>
    </footer>
  );
}
