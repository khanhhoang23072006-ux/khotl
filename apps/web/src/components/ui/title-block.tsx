import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Khung tên: lưới ô có đường kẻ 1px bên trong, viền ngoài 2px. Số cột do className quyết định. */
export function TitleBlock({
  className,
  children,
  as: Tag = "div",
}: {
  className?: string;
  children: ReactNode;
  as?: "div" | "section" | "dl" | "ul" | "header";
}) {
  return <Tag className={cn("tb", className)}>{children}</Tag>;
}

/** Một ô của khung tên: nhãn nhỏ màu bút chì phía trên, giá trị phía dưới. */
export function Cell({
  label,
  children,
  className,
  tone = "sheet",
}: {
  label?: ReactNode;
  children: ReactNode;
  className?: string;
  tone?: "sheet" | "paper" | "ink";
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col justify-end px-3 py-2",
        tone === "sheet" && "bg-sheet",
        tone === "paper" && "bg-paper",
        tone === "ink" && "bg-ink text-paper",
        className,
      )}
    >
      {label ? <span className="text-[11px] leading-tight text-pencil">{label}</span> : null}
      <span className="min-w-0 text-[13px] font-semibold leading-snug">{children}</span>
    </div>
  );
}

export function SectionHeading({
  children,
  action,
  id,
}: {
  children: ReactNode;
  action?: ReactNode;
  id?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <h2 id={id} className="font-head text-lg">
        {children}
      </h2>
      {action ? <div className="text-[13px] font-semibold">{action}</div> : null}
    </div>
  );
}

export function PageHeader({
  title,
  kicker,
  children,
  className,
}: {
  title: ReactNode;
  kicker?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("grid-paper border-b-2 border-ink", className)}>
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 md:py-8">
        {kicker ? <p className="text-[13px] text-pencil">{kicker}</p> : null}
        <h1 className="font-code text-4xl leading-[0.98] md:text-5xl">{title}</h1>
        {children}
      </div>
    </header>
  );
}

export function EmptyState({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return (
    <div className="border-2 border-dashed border-ink/40 bg-sheet px-4 py-8 text-center">
      <p className="font-head text-base">{title}</p>
      {children ? <div className="mt-2 text-sm text-pencil">{children}</div> : null}
    </div>
  );
}
