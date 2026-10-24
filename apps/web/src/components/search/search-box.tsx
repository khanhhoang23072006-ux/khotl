"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import { SearchIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

interface Suggestion {
  kind: "course" | "document";
  href: string;
  primary: string;
  secondary: string;
}

interface ApiResponse {
  courses: { code: string; name: string; documentCount: number }[];
  documents: { slug: string; title: string; courseCode: string }[];
}

/**
 * Ô tìm kiếm có gợi ý khi gõ (mã học phần, tiêu đề tài liệu). Là form GET thông thường,
 * nên vẫn tìm được khi JavaScript chưa tải. Điều khiển bằng bàn phím theo mẫu combobox ARIA.
 */
export function SearchBox({
  defaultValue = "",
  size = "md",
  autoFocus = false,
  hiddenFields = {},
}: {
  defaultValue?: string;
  size?: "md" | "lg";
  autoFocus?: boolean;
  hiddenFields?: Record<string, string | undefined>;
}) {
  const t = useTranslations("search");
  const router = useRouter();
  const listId = useId();
  const [value, setValue] = useState(defaultValue);
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    const q = value.trim();
    if (q.length < 2) {
      setItems([]);
      return;
    }
    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const response = await fetch(`/api/goi-y?q=${encodeURIComponent(q)}`, { signal: controller.signal });
        if (!response.ok) return;
        const data = (await response.json()) as ApiResponse;
        setItems([
          ...data.courses.map((course) => ({
            kind: "course" as const,
            href: `/hoc-phan/${course.code}`,
            primary: course.code,
            secondary: course.name,
          })),
          ...data.documents.map((doc) => ({
            kind: "document" as const,
            href: `/tai-lieu/${doc.slug}`,
            primary: doc.title,
            secondary: doc.courseCode,
          })),
        ]);
        setActive(-1);
      } catch {
        // bỏ qua lỗi mạng và yêu cầu bị hủy
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [value]);

  const showList = open && items.length > 0;
  const big = size === "lg";

  return (
    <search>
    <form action="/tim-kiem" method="get" className="relative" onSubmit={() => setOpen(false)}>
      {Object.entries(hiddenFields).map(([name, fieldValue]) =>
        fieldValue ? <input key={name} type="hidden" name={name} value={fieldValue} /> : null,
      )}
      <div
        className={cn(
          "flex border-2 border-ink bg-sheet focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-stamp",
          big ? "h-[52px]" : "h-11",
        )}
      >
        <label className="flex min-w-0 flex-1 items-center gap-2.5 px-3 text-pencil">
          <SearchIcon />
          <span className="sr-only">{t("label")}</span>
          <input
            type="search"
            name="q"
            ref={inputRef}
            value={value}
            autoComplete="off"
            enterKeyHint="search"
            placeholder={t("placeholder")}
            className="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-pencil"
            role="combobox"
            aria-expanded={showList}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
            onChange={(event) => {
              setValue(event.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 120)}
            onKeyDown={(event) => {
              if (!showList) return;
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActive((index) => (index + 1) % items.length);
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setActive((index) => (index <= 0 ? items.length - 1 : index - 1));
              } else if (event.key === "Escape") {
                setOpen(false);
              } else if (event.key === "Enter" && active >= 0) {
                event.preventDefault();
                const item = items[active];
                if (item) {
                  setOpen(false);
                  router.push(item.href);
                }
              }
            }}
          />
        </label>
        <button
          type="submit"
          className={cn(
            "border-l-2 border-ink bg-stamp font-head text-stamp-ink hover:bg-ink hover:text-paper",
            big ? "w-20 text-base" : "w-16 text-[15px]",
          )}
        >
          {t("submit")}
        </button>
      </div>
      {showList ? (
        <div
          id={listId}
          role="listbox"
          aria-label={t("suggestions")}
          className="absolute inset-x-0 top-full z-40 -mt-0.5 border-2 border-ink bg-sheet shadow-[4px_4px_0_var(--ink)]"
        >
          {items.map((item, index) => (
            <div
              key={`${item.kind}-${item.href}`}
              id={`${listId}-${index}`}
              role="option"
              tabIndex={-1}
              aria-selected={index === active}
              className={cn(
                "flex cursor-pointer items-baseline gap-3 border-b border-grid px-3 py-2 last:border-b-0",
                index === active ? "bg-ink text-paper" : "hover:bg-wash",
              )}
              onMouseDown={(event) => {
                event.preventDefault();
                setOpen(false);
                router.push(item.href);
              }}
            >
              {item.kind === "course" ? (
                <>
                  <span className="font-code text-lg leading-none">{item.primary}</span>
                  <span className="truncate text-[13px]">{item.secondary}</span>
                </>
              ) : (
                <>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{item.primary}</span>
                  <span className="font-head text-[12px] opacity-70">{item.secondary}</span>
                </>
              )}
            </div>
          ))}
        </div>
      ) : null}
    </form>
    </search>
  );
}
