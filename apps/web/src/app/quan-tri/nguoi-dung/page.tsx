import { PERMISSIONS } from "@khotl/core";
import { prisma } from "@khotl/db";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { GrantRoleForm, RevokeRoleButton } from "@/components/admin/role-forms";
import { requirePermission } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin");
  return { title: t("usersTab"), robots: { index: false } };
}

export default async function AdminUsersPage() {
  await requirePermission(PERMISSIONS.adminUsers, "/quan-tri/nguoi-dung");
  const t = await getTranslations("admin");
  const [faculties, assignments] = await Promise.all([
    prisma.faculty.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, code: true, name: true } }),
    prisma.userRole.findMany({
      where: { role: { key: { in: ["MODERATOR", "ADMIN"] } } },
      orderBy: { createdAt: "desc" },
      include: {
        role: { select: { key: true } },
        user: { select: { name: true, email: true } },
        faculty: { select: { code: true } },
      },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <section className="border-2 border-ink bg-sheet p-4">
        <h2 className="mb-3 font-head text-lg">{t("grantTitle")}</h2>
        <GrantRoleForm faculties={faculties.map((f) => ({ id: f.id, label: `${f.code}: ${f.name}` }))} />
        <p className="mt-2 text-[12px] text-pencil">{t("grantHint")}</p>
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="font-head text-lg">{t("staffTitle")}</h2>
        <table className="w-full border-collapse border-2 border-ink bg-sheet text-sm">
          <thead>
            <tr className="text-left text-[11px] text-pencil">
              <th scope="col" className="border border-ink px-2 py-1.5 font-medium">{t("person")}</th>
              <th scope="col" className="border border-ink px-2 py-1.5 font-medium">{t("role")}</th>
              <th scope="col" className="border border-ink px-2 py-1.5 font-medium">{t("scope")}</th>
              <th scope="col" className="w-24 border border-ink px-2 py-1.5" />
            </tr>
          </thead>
          <tbody>
            {assignments.map((assignment) => (
              <tr key={assignment.id}>
                <td className="border border-ink px-2 py-1.5">
                  {assignment.user.name}
                  <span className="block text-[12px] text-pencil">{assignment.user.email}</span>
                </td>
                <td className="border border-ink px-2 py-1.5 font-head">
                  {t(`roles.${assignment.role.key}` as "roles.ADMIN")}
                </td>
                <td className="border border-ink px-2 py-1.5">{assignment.faculty?.code ?? t("scopeAll")}</td>
                <td className="border border-ink px-2 py-1.5 text-right">
                  <RevokeRoleButton userRoleId={assignment.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
