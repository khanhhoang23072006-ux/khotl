"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Ô điều hướng: trang đang mở được đảo màu (nền mực, chữ giấy). */
export function NavLink({
  href,
  children,
  className,
  activeClassName = "bg-ink text-paper hover:text-paper",
  exact = false,
}: {
  href: string;
  children: ReactNode;
  className?: string;
  activeClassName?: string;
  exact?: boolean;
}) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={cn(className, active && activeClassName)}>
      {children}
    </Link>
  );
}
