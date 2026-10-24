"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useRef } from "react";
import { authClient } from "@/lib/auth-client";

interface Props {
  initials: string;
  name: string;
  email: string;
  links: { href: string; label: string }[];
}

/** Menu tài khoản dùng <details> nên vẫn mở được khi JavaScript chưa tải xong. */
export function UserMenu({ initials, name, email, links }: Props) {
  const t = useTranslations("nav");
  const ref = useRef<HTMLDetailsElement>(null);
  const close = () => ref.current?.removeAttribute("open");

  return (
    <details ref={ref} className="relative">
      <summary
        className="flex h-11 w-11 cursor-pointer list-none items-center justify-center hover:bg-wash [&::-webkit-details-marker]:hidden"
        aria-label={t("account")}
      >
        <span className="flex h-[30px] w-[30px] items-center justify-center border-2 border-ink font-code text-[13px]">
          {initials}
        </span>
      </summary>
      <div className="absolute right-0 top-12 z-40 w-64 border-2 border-ink bg-sheet shadow-[4px_4px_0_var(--ink)]">
        <div className="border-b border-ink px-3 py-2">
          <p className="truncate font-head text-sm">{name}</p>
          <p className="truncate text-[12px] text-pencil">{email}</p>
        </div>
        <ul className="flex flex-col">
          {links.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                onClick={close}
                className="flex h-11 items-center border-b border-grid px-3 text-sm hover:bg-wash"
              >
                {link.label}
              </Link>
            </li>
          ))}
          <li>
            <button
              type="button"
              className="flex h-11 w-full items-center px-3 text-left text-sm hover:bg-wash"
              onClick={async () => {
                close();
                await authClient.signOut();
                window.location.assign("/");
              }}
            >
              {t("signOut")}
            </button>
          </li>
        </ul>
      </div>
    </details>
  );
}
