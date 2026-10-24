import { can, PERMISSIONS } from "@khotl/core";
import { prisma } from "@khotl/db";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CreditMeter } from "@/components/credits/credit-meter";
import { BellIcon } from "@/components/icons";
import { getCurrentUser } from "@/lib/session";
import { getCreditStatus } from "@/server/credits/ledger";
import { initials } from "@/lib/utils";
import { LocaleSwitch } from "./locale-switch";
import { LogoMark } from "./logo";
import { NavLink } from "./nav-link";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

export async function SiteHeader() {
  const t = await getTranslations("nav");
  const tc = await getTranslations("common");
  const user = await getCurrentUser();
  const unread = user
    ? await prisma.notification.count({ where: { userId: user.id, readAt: null } })
    : 0;
  const credits = user ? await getCreditStatus(user.id) : null;
  const isModerator = user ? can(user, PERMISSIONS.documentModerate) : false;
  const isAdmin = user ? can(user, PERMISSIONS.adminCatalog) : false;

  const navCell =
    "flex h-full items-center px-4 font-head text-[15px] hover:bg-wash hover:text-ink";

  const menuLinks = [
    { href: "/tai-lieu-cua-toi", label: t("myDocuments") },
    { href: "/luot-tai", label: t("credits") },
    { href: "/thong-bao", label: t("notifications") },
    { href: "/hoan-thien-ho-so", label: t("profile") },
    ...(isModerator ? [{ href: "/kiem-duyet", label: t("moderation") }] : []),
    ...(isAdmin ? [{ href: "/quan-tri/hoc-phan", label: t("admin") }] : []),
  ];

  return (
    <header className="sticky top-0 z-30 border-b-2 border-ink bg-paper">
      <a
        href="#noi-dung"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:bg-ink focus:px-3 focus:py-2 focus:text-paper"
      >
        {tc("skipToContent")}
      </a>
      <div className="mx-auto flex h-14 max-w-6xl items-stretch">
        <Link
          href="/"
          className="flex items-center gap-2.5 pl-4 pr-4 hover:text-ink md:border-r-2 md:border-ink"
        >
          <LogoMark />
          <span className="font-head text-[19px] font-extrabold tracking-tight">{tc("appName")}</span>
        </Link>

        <nav aria-label={t("main")} className="hidden items-stretch md:flex">
          <NavLink href="/tim-kiem" className={navCell}>
            {t("search")}
          </NavLink>
          <NavLink href="/vien" className={navCell}>
            {t("faculties")}
          </NavLink>
          {isModerator ? (
            <NavLink href="/kiem-duyet" className={navCell}>
              {t("moderation")}
            </NavLink>
          ) : null}
          {isAdmin ? (
            <NavLink href="/quan-tri" className={navCell}>
              {t("admin")}
            </NavLink>
          ) : null}
        </nav>

        <div className="ml-auto flex items-center pr-1.5">
          <Link
            href="/tai-len"
            className="mr-2 hidden h-10 items-center border-2 border-ink bg-stamp px-4 font-head text-[15px] text-stamp-ink hover:bg-ink hover:text-paper md:flex"
          >
            {t("upload")}
          </Link>
          <div className="hidden sm:flex">
            <LocaleSwitch />
            <ThemeToggle />
          </div>
          {user ? (
            <>
              {credits ? <CreditMeter status={credits} /> : null}
              <Link
                href="/thong-bao"
                className="relative flex h-11 w-11 items-center justify-center hover:bg-wash hover:text-ink"
                aria-label={unread > 0 ? t("notificationsUnread", { count: unread }) : t("notifications")}
              >
                <BellIcon size={22} />
                {unread > 0 ? <span className="absolute right-2.5 top-2.5 h-2 w-2 bg-stamp" /> : null}
              </Link>
              <UserMenu
                initials={initials(user.displayName || user.name)}
                name={user.displayName || user.name}
                email={user.email}
                links={menuLinks}
              />
            </>
          ) : (
            <Link
              href="/dang-nhap"
              className="flex h-11 items-center px-3 font-head text-[15px] hover:bg-wash hover:text-ink"
            >
              {t("signIn")}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
