"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { type ReactNode, useEffect, useRef } from "react";
import { Button, buttonVariants } from "@/components/ui/button";

/**
 * Nút tải khi đã hết lượt: bấm vào mở hộp thoại giải thích cách kiếm thêm,
 * có nút dẫn thẳng tới form tải lên. `openOnMount` dùng cho trang /het-luot.
 */
export function OutOfCreditsDialog({
  label,
  body,
  openOnMount = false,
  backHref,
  trigger = true,
}: {
  label?: ReactNode;
  /** false: không hiện nút mở, chỉ hộp thoại (dùng với openOnMount) */
  trigger?: boolean;
  body: string;
  openOnMount?: boolean;
  backHref?: string;
}) {
  const t = useTranslations("credits");
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (openOnMount) ref.current?.showModal();
  }, [openOnMount]);
  return (
    <>
      {trigger ? (
        <Button variant="primary" size="lg" className="w-full" onClick={() => ref.current?.showModal()}>
          {label}
        </Button>
      ) : null}
      <dialog
        ref={ref}
        aria-labelledby="out-of-credits-title"
        className="m-auto w-[min(520px,calc(100%-32px))] border-2 border-ink bg-sheet p-0 text-ink shadow-[6px_6px_0_var(--stamp)] backdrop:bg-ink/50"
      >
        <div className="flex flex-col gap-3 px-5 py-5">
          <h2 id="out-of-credits-title" className="font-code text-3xl leading-none">
            {t("outTitle")}
          </h2>
          <p className="text-sm">{body}</p>
          <p className="text-[13px] text-pencil">{t("outPreview")}</p>
          <div className="mt-1 flex flex-wrap gap-2">
            <Link href="/tai-len" className={buttonVariants({ variant: "primary" })}>
              {t("outUpload")}
            </Link>
            <Link href="/luot-tai" className={buttonVariants({ variant: "outline" })}>
              {t("outHistory")}
            </Link>
            {backHref ? (
              <Link href={backHref} className={buttonVariants({ variant: "ghost" })}>
                {t("outBack")}
              </Link>
            ) : (
              <Button variant="ghost" onClick={() => ref.current?.close()}>
                {t("outClose")}
              </Button>
            )}
          </div>
        </div>
      </dialog>
    </>
  );
}
