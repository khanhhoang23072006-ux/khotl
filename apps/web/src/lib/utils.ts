import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Chỉ cho phép chuyển hướng về đường dẫn nội bộ (chống open redirect qua ?next=). */
export function safeNext(next: string | null | undefined, fallback = "/"): string {
  if (!next?.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return fallback;
  }
  return next;
}

/** Tên viết tắt cho ô avatar, ví dụ "Nguyễn Văn Hà" → "NH". */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const first = words[0]?.[0] ?? "";
  const last = words.length > 1 ? (words[words.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}
