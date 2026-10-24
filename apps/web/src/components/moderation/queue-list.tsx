"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { DecisionPanel } from "./decision-panel";

export interface QueueItem {
  id: string;
  title: string;
  courseCode: string;
  typeLabel: string;
  fileLabel: string;
  uploader: string;
  uploaderNote: string;
  riskScore: number;
  riskLevel: "low" | "medium" | "high";
  riskReasons: string[];
  waiting: string;
}

/** Hàng chờ có chọn nhiều để duyệt hàng loạt. */
export function QueueList({ items, templates }: { items: QueueItem[]; templates: readonly string[] }) {
  const t = useTranslations("moderation");
  const [selected, setSelected] = useState<string[]>([]);
  const toggle = (id: string) =>
    setSelected((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));
  const allSelected = selected.length === items.length && items.length > 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="sticky top-14 z-20 flex flex-col gap-2 border-2 border-ink bg-paper p-2">
        <div className="flex items-center justify-between gap-2 px-1">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-5 w-5 accent-[var(--ink)]"
              checked={allSelected}
              onChange={() => setSelected(allSelected ? [] : items.map((item) => item.id))}
            />
            {selected.length > 0 ? t("selected", { count: selected.length }) : t("selectAll")}
          </label>
          {selected.length > 0 ? (
            <button type="button" className="text-[13px] underline" onClick={() => setSelected([])}>
              {t("clearSelection")}
            </button>
          ) : null}
        </div>
        {selected.length > 0 ? (
          <DecisionPanel documentIds={selected} templates={templates} compact onDone={() => setSelected([])} />
        ) : null}
      </div>

      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <li
            key={item.id}
            className={cn("tb grid-cols-[44px_1fr_auto]", selected.includes(item.id) && "outline-2 outline-stamp")}
          >
            <label className="flex items-start justify-center bg-sheet pt-3">
              <span className="sr-only">{t("selectItem", { title: item.title })}</span>
              <input
                type="checkbox"
                className="h-5 w-5 accent-[var(--ink)]"
                checked={selected.includes(item.id)}
                onChange={() => toggle(item.id)}
              />
            </label>
            <Link href={`/kiem-duyet/${item.id}`} className="flex min-w-0 flex-col gap-1 bg-sheet px-3 py-2 hover:bg-wash hover:text-ink">
              <span className="font-semibold leading-snug">{item.title}</span>
              <span className="text-[12px] text-pencil">
                <span className="font-head text-ink">{item.courseCode}</span> {item.typeLabel}, {item.fileLabel}.{" "}
                {item.uploader} ({item.uploaderNote}). {item.waiting}
              </span>
              {item.riskReasons.length > 0 ? (
                <span className="text-[12px] text-stamp">{item.riskReasons.join("; ")}</span>
              ) : null}
            </Link>
            <div
              className={cn(
                "flex w-24 flex-col items-center justify-center px-2 text-center",
                item.riskLevel === "high" ? "bg-stamp text-stamp-ink" : item.riskLevel === "medium" ? "bg-ink text-paper" : "bg-sheet",
              )}
            >
              <span className="text-[11px] opacity-80">{t("risk")}</span>
              <span className="font-head text-sm">{t(`riskLevels.${item.riskLevel}`)}</span>
              <span className="text-[11px] opacity-80">{item.riskScore}/100</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
