import { PERMISSIONS } from "@khotl/core";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { NavLink } from "@/components/layout/nav-link";
import { requirePermission } from "@/lib/session";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requirePermission(PERMISSIONS.adminCatalog, "/quan-tri");
  const t = await getTranslations("admin");
  const tab = "flex h-11 items-center bg-sheet px-4 font-head text-sm hover:bg-wash hover:text-ink";
  const active = "bg-ink text-paper hover:bg-ink hover:text-paper";
  return (
    <div className="mx-auto max-w-6xl px-4 py-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-code text-4xl leading-none">{t("title")}</h1>
        <nav aria-label={t("title")} className="tb grid-flow-col">
          <NavLink href="/quan-tri/hoc-phan" className={tab} activeClassName={active}>
            {t("coursesTab")}
          </NavLink>
          <NavLink href="/quan-tri/nguoi-dung" className={tab} activeClassName={active}>
            {t("usersTab")}
          </NavLink>
        </nav>
      </div>
      {children}
    </div>
  );
}
