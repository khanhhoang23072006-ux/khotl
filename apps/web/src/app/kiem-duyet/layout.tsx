import { moderationScope, PERMISSIONS } from "@khotl/core";
import { prisma } from "@khotl/db";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { NavLink } from "@/components/layout/nav-link";
import { requirePermission } from "@/lib/session";

export default async function ModerationLayout({ children }: { children: ReactNode }) {
  const user = await requirePermission(PERMISSIONS.documentModerate, "/kiem-duyet");
  const t = await getTranslations("moderation");
  const scope = moderationScope(user);
  const scopeWhere = scope === null ? {} : { course: { facultyId: { in: scope } } };
  const [pending, reports, faculties] = await Promise.all([
    prisma.document.count({ where: { status: "PENDING_REVIEW", ...scopeWhere } }),
    prisma.report.count({
      where: {
        status: { in: ["OPEN", "IN_REVIEW"] },
        ...(scope === null ? {} : { document: { course: { facultyId: { in: scope } } } }),
      },
    }),
    scope === null
      ? Promise.resolve([])
      : prisma.faculty.findMany({ where: { id: { in: scope } }, select: { shortName: true, name: true } }),
  ]);
  const tab = "flex h-11 items-center gap-2 bg-sheet px-4 font-head text-sm hover:bg-wash hover:text-ink";

  return (
    <div className="mx-auto max-w-6xl px-4 py-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-code text-4xl leading-none">{t("title")}</h1>
          <p className="mt-1 text-[13px] text-pencil">
            {scope === null
              ? t("scopeAll")
              : t("scopeFaculties", { faculties: faculties.map((f) => f.shortName ?? f.name).join(", ") })}
          </p>
        </div>
        <nav aria-label={t("title")} className="tb grid-flow-col">
          <NavLink href="/kiem-duyet" exact className={tab} activeClassName="bg-ink text-paper hover:bg-ink hover:text-paper">
            {t("queueTab")} <span className="font-code text-lg">{pending}</span>
          </NavLink>
          <NavLink
            href="/kiem-duyet/bao-cao"
            className={tab}
            activeClassName="bg-ink text-paper hover:bg-ink hover:text-paper"
          >
            {t("reportsTab")} <span className="font-code text-lg">{reports}</span>
          </NavLink>
        </nav>
      </div>
      {children}
    </div>
  );
}
