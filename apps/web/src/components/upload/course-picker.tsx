"use client";

import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface PickedCourse {
  id: string;
  code: string;
  name: string;
}

/** Ô chọn học phần: gõ mã hoặc tên (không dấu cũng được), chọn từ danh sách gợi ý. */
export function CoursePicker({
  id,
  value,
  onChange,
  invalid,
  describedBy,
}: {
  id: string;
  value: PickedCourse | null;
  onChange: (course: PickedCourse | null) => void;
  invalid?: boolean;
  describedBy?: string;
}) {
  const t = useTranslations("upload");
  const listId = useId();
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<PickedCourse[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setItems([]);
      return;
    }
    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const response = await fetch(`/api/goi-y?loai=hoc-phan&q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });
        if (!response.ok) return;
        const data = (await response.json()) as { courses: PickedCourse[] };
        setItems(data.courses);
        setActive(0);
      } catch {
        // bỏ qua
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [query]);

  if (value) {
    return (
      <div className="flex h-11 items-stretch border-2 border-ink bg-sheet">
        <span className="flex items-center border-r-2 border-ink px-3 font-code text-xl">{value.code}</span>
        <span className="flex min-w-0 flex-1 items-center truncate px-3 text-sm">{value.name}</span>
        <button
          type="button"
          className="border-l-2 border-ink px-3 text-[13px] font-semibold hover:bg-wash"
          onClick={() => {
            onChange(null);
            setQuery("");
          }}
        >
          {t("changeCourse")}
        </button>
      </div>
    );
  }

  const showList = open && items.length > 0;
  return (
    <div className="relative">
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-invalid={invalid}
        aria-describedby={describedBy}
        aria-activedescendant={showList ? `${listId}-${active}` : undefined}
        autoComplete="off"
        value={query}
        placeholder={t("coursePlaceholder")}
        className={cn(
          "h-11 w-full rounded-none border-2 border-ink bg-sheet px-3 text-[15px] placeholder:text-pencil",
          invalid && "border-stamp",
        )}
        onChange={(event) => {
          setQuery(event.target.value);
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
          } else if (event.key === "Enter") {
            event.preventDefault();
            const item = items[active];
            if (item) onChange(item);
          } else if (event.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {showList ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-full z-30 -mt-0.5 max-h-72 overflow-auto border-2 border-ink bg-sheet shadow-[4px_4px_0_var(--ink)]"
        >
          {items.map((item, index) => (
            <li
              key={item.id}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              className={cn(
                "flex cursor-pointer items-baseline gap-3 border-b border-grid px-3 py-2 last:border-b-0",
                index === active ? "bg-ink text-paper" : "hover:bg-wash",
              )}
              onMouseDown={(event) => {
                event.preventDefault();
                onChange(item);
              }}
            >
              <span className="font-code text-lg leading-none">{item.code}</span>
              <span className="truncate text-[13px]">{item.name}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
