import { getTranslations } from "next-intl/server";
import { GridIcon, HomeIcon, PlusIcon, SearchIcon, UserIcon } from "@/components/icons";
import { getCurrentUser } from "@/lib/session";
import { NavLink } from "./nav-link";

/** Thanh điều hướng dưới cùng trên điện thoại, mỗi ô cao 60px (vùng chạm ≥ 44px). */
export async function MobileNav() {
  const t = await getTranslations("nav");
  const user = await getCurrentUser();
  const cell =
    "flex h-[60px] flex-col items-center justify-center gap-[3px] bg-paper text-[11px] hover:text-ink";
  const active = "bg-ink text-paper hover:text-paper font-semibold";
  return (
    <nav
      aria-label={t("main")}
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 gap-px border-t-2 border-ink bg-ink pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <NavLink href="/" exact className={cell} activeClassName={active}>
        <HomeIcon />
        {t("home")}
      </NavLink>
      <NavLink href="/tim-kiem" className={cell} activeClassName={active}>
        <SearchIcon />
        {t("search")}
      </NavLink>
      <NavLink
        href="/tai-len"
        className="flex h-[60px] flex-col items-center justify-center gap-[3px] bg-stamp text-[11px] font-semibold text-stamp-ink hover:text-stamp-ink"
        activeClassName="bg-ink"
      >
        <PlusIcon />
        {t("upload")}
      </NavLink>
      <NavLink href="/vien" className={cell} activeClassName={active}>
        <GridIcon />
        {t("faculties")}
      </NavLink>
      <NavLink href={user ? "/tai-lieu-cua-toi" : "/dang-nhap"} className={cell} activeClassName={active}>
        <UserIcon />
        {user ? t("me") : t("signIn")}
      </NavLink>
    </nav>
  );
}
