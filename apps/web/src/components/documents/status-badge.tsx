import { getTranslations } from "next-intl/server";
import { cn } from "@/lib/utils";

const TONE: Record<string, string> = {
  APPROVED: "border-stamp text-stamp",
  PENDING_REVIEW: "border-ink text-ink",
  PROCESSING: "border-ink text-ink",
  CHANGES_REQUESTED: "border-stamp bg-stamp text-stamp-ink",
  REJECTED: "border-pencil text-pencil",
  REMOVED: "border-pencil text-pencil line-through",
  DRAFT: "border-pencil text-pencil",
};

export async function StatusBadge({ status }: { status: string }) {
  const t = await getTranslations("status");
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center border-2 px-2 font-head text-[12px]",
        TONE[status] ?? "border-ink",
      )}
    >
      {t(status as Parameters<typeof t>[0])}
    </span>
  );
}
