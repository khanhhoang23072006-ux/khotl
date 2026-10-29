import { FEEDBACK_STATUSES, type FeedbackStatus, feedbackDueAt, formatDateTime, isFeedbackOverdue } from "@khotl/core";
import { prisma } from "@khotl/db";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { FeedbackReply } from "@/components/support/feedback-admin";
import { Cell, EmptyState, TitleBlock } from "@/components/ui/title-block";
import { currentLocale } from "@/lib/locale";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("feedback.admin");
  return { title: t("tab"), robots: { index: false } };
}

/** Hộp thư hỗ trợ: phiếu góp ý, báo lỗi; phiếu quá hạn phản hồi được đánh dấu. */
export default async function AdminFeedbackPage({ searchParams }: { searchParams: Promise<{ "trang-thai"?: string }> }) {
  const params = await searchParams;
  const status: FeedbackStatus = FEEDBACK_STATUSES.includes(params["trang-thai"] as FeedbackStatus) ? (params["trang-thai"] as FeedbackStatus) : "OPEN";
  const t = await getTranslations("feedback");
  const ta = await getTranslations("feedback.admin");
  const locale = await currentLocale();
  const now = new Date();
  const [items, counts, answered] = await Promise.all([
    prisma.feedback.findMany({ where: { status }, orderBy: { createdAt: status === "OPEN" ? "asc" : "desc" }, take: 100 }),
    prisma.feedback.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.feedback.findMany({
      where: { respondedAt: { not: null }, createdAt: { gte: new Date(now.getTime() - 30 * 86_400_000) } },
      select: { createdAt: true, respondedAt: true },
    }),
  ]);
  const count = (s: FeedbackStatus) => counts.find((row) => row.status === s)?._count._all ?? 0;
  const openItems = status === "OPEN" ? items : await prisma.feedback.findMany({ where: { status: "OPEN" }, select: { kind: true, status: true, createdAt: true } });
  const overdue = openItems.filter((item) => isFeedbackOverdue(item, now)).length;
  const hours = answered.map((row) => ((row.respondedAt?.getTime() ?? 0) - row.createdAt.getTime()) / 3600_000).sort((a, b) => a - b);
  const median = hours.length ? hours[Math.floor(hours.length / 2)] : null;

  return (
    <div className="flex flex-col gap-6">
      <TitleBlock className="grid-cols-2 md:grid-cols-4">
        <Cell label={ta("open")}>
          <span className="font-code text-2xl">{count("OPEN")}</span>
        </Cell>
        <Cell label={ta("overdue")}>
          <span className={`font-code text-2xl ${overdue ? "text-stamp" : ""}`}>{overdue}</span>
        </Cell>
        <Cell label={ta("answered")}>
          <span className="font-code text-2xl">{count("ANSWERED")}</span>
        </Cell>
        <Cell label={ta("medianResponse")}>
          <span className="font-code text-2xl">{median === null ? "–" : ta("hours", { hours: Math.round(median * 10) / 10 })}</span>
        </Cell>
      </TitleBlock>

      <nav aria-label={ta("filter")} className="tb w-fit grid-flow-col">
        {FEEDBACK_STATUSES.map((s) => (
          <Link
            key={s}
            href={`/quan-tri/gop-y?trang-thai=${s}`}
            aria-current={s === status ? "page" : undefined}
            className={`flex h-11 items-center px-4 text-sm ${s === status ? "bg-ink text-paper" : "bg-sheet hover:bg-wash"}`}
          >
            {ta(`status.${s}`)} ({count(s)})
          </Link>
        ))}
      </nav>

      {items.length ? (
        <ul className="flex flex-col gap-4">
          {items.map((item) => {
            const late = isFeedbackOverdue(item, now);
            return (
              <li key={item.id} className="border-2 border-ink bg-sheet">
                <details>
                  <summary className="flex cursor-pointer flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3">
                    <span className="font-code text-lg">{item.code}</span>
                    <span className="border border-ink px-2 text-[12px]">{t(`kinds.${item.kind}`)}</span>
                    <b className="min-w-0 flex-1">{item.subject}</b>
                    <span className="text-[13px] text-pencil">{formatDateTime(item.createdAt, locale)}</span>
                    {late ? <span className="bg-stamp px-2 text-[12px] font-semibold text-stamp-ink">{ta("lateBadge")}</span> : null}
                  </summary>
                  <div className="flex flex-col gap-3 border-t-2 border-ink px-4 py-3 text-sm">
                    <p className="text-pencil">
                      {ta("from", { email: item.email })} · {ta("due", { at: formatDateTime(feedbackDueAt(item.kind, item.createdAt), locale) })}
                      {item.pageUrl ? ` · ${item.pageUrl}` : ""}
                    </p>
                    <p className="whitespace-pre-line">{item.body}</p>
                    <FeedbackReply id={item.id} status={item.status} previousReply={item.reply} />
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState title={ta("empty")} />
      )}
    </div>
  );
}
