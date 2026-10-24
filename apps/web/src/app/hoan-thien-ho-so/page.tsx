import { prisma } from "@khotl/db";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ProfileForm } from "@/components/account/profile-form";
import { currentLocale } from "@/lib/locale";
import { requireUser } from "@/lib/session";
import { safeNext } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("profile");
  return { title: t("title"), robots: { index: false } };
}

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; tu?: string }>;
}) {
  const { next: rawNext, tu } = await searchParams;
  const next = safeNext(rawNext);
  const user = await requireUser(`/hoan-thien-ho-so?next=${encodeURIComponent(next)}`);
  // Vừa đăng nhập mà hồ sơ đã đủ thì đi thẳng tới trang cần đến
  if (tu === "dang-nhap" && user.profileComplete) redirect(next);

  const t = await getTranslations("profile");
  const locale = await currentLocale();
  const [faculties, record] = await Promise.all([
    prisma.faculty.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true, nameEn: true, code: true } }),
    prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { studentCode: true } }),
  ]);

  return (
    <div className="mx-auto grid max-w-4xl gap-8 px-4 py-8 md:grid-cols-[1fr_440px]">
      <div className="flex flex-col gap-2">
        <h1 className="font-code text-5xl leading-[0.95]">{user.profileComplete ? t("editTitle") : t("title")}</h1>
        <p className="text-[15px]">{t("intro")}</p>
        <p className="text-[13px] text-pencil">{t("signedInAs", { email: user.email })}</p>
      </div>
      <div className="border-2 border-ink bg-sheet p-4">
        <ProfileForm
          next={next}
          faculties={faculties.map((faculty) => ({
            id: faculty.id,
            label: `${faculty.code}: ${locale === "en" && faculty.nameEn ? faculty.nameEn : faculty.name}`,
          }))}
          initial={{
            username: user.username ?? "",
            displayName: user.displayName ?? "",
            facultyId: user.facultyId ?? "",
            cohort: user.cohort ? String(user.cohort) : "",
            studentCode: record.studentCode ?? "",
            acceptTerms: user.profileComplete,
          }}
        />
      </div>
    </div>
  );
}
