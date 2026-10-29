import { FEEDBACK_KINDS, FEEDBACK_SLA_HOURS, type FeedbackKind } from "@khotl/core";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { FeedbackForm } from "@/components/support/feedback-form";
import { PageHeader } from "@/components/ui/title-block";
import { getCurrentUser } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("feedback");
  return { title: t("title") };
}

/** Kênh hỗ trợ: góp ý, báo lỗi, hỏi về tài khoản, kèm thời gian phản hồi dự kiến. */
export default async function FeedbackPage({ searchParams }: { searchParams: Promise<{ loai?: string; trang?: string }> }) {
  const { loai, trang } = await searchParams;
  const t = await getTranslations("feedback");
  const user = await getCurrentUser();
  const kind = FEEDBACK_KINDS.includes(loai as FeedbackKind) ? (loai as FeedbackKind) : undefined;
  return (
    <>
      <PageHeader title={t("title")}>
        <p className="max-w-2xl text-[15px]">{t("intro")}</p>
      </PageHeader>
      <div className="mx-auto grid max-w-5xl gap-6 px-4 py-6 md:grid-cols-[minmax(0,1fr)_280px]">
        <div className="border-2 border-ink bg-sheet p-4">
          <FeedbackForm signedInEmail={user?.email ?? null} initialKind={kind} initialPage={trang?.slice(0, 500)} />
        </div>
        <aside className="flex flex-col gap-3 text-sm">
          <h2 className="font-head text-base">{t("slaTitle")}</h2>
          <ul className="tb grid-cols-1">
            {FEEDBACK_KINDS.map((k) => (
              <li key={k} className="flex justify-between gap-3 bg-sheet px-3 py-2">
                <span>{t(`kinds.${k}`)}</span>
                <b className="whitespace-nowrap">{t("slaHours", { hours: FEEDBACK_SLA_HOURS[k] })}</b>
              </li>
            ))}
          </ul>
          <p className="text-[13px] text-pencil">{t("slaNote")}</p>
        </aside>
      </div>
    </>
  );
}
