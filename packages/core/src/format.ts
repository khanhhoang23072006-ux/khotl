import type { Locale } from "./term";

/** 1234 → "1,2k" (vi) / "1.2k" (en). */
export function formatCount(value: number, locale: Locale = "vi"): string {
  if (value < 1000) return String(value);
  const unit = value >= 1_000_000 ? 1_000_000 : 1000;
  const suffix = unit === 1_000_000 ? "tr" : "k";
  const scaled = Math.floor((value / unit) * 10) / 10;
  const text = Number.isInteger(scaled) ? String(scaled) : scaled.toFixed(1);
  const localized = locale === "vi" ? text.replace(".", ",") : text;
  return `${localized}${locale === "en" && suffix === "tr" ? "M" : suffix}`;
}

export function formatBytes(bytes: number, locale: Locale = "vi"): string {
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index++;
  }
  const text = index === 0 ? String(value) : value.toFixed(1);
  return `${locale === "vi" ? text.replace(".", ",") : text} ${units[index]}`;
}

export function formatRating(score: number, locale: Locale = "vi"): string {
  const text = score.toFixed(1);
  return locale === "vi" ? text.replace(".", ",") : text;
}

export function formatDate(date: Date, locale: Locale = "vi"): string {
  return new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(date);
}

export function formatDateTime(date: Date, locale: Locale = "vi"): string {
  return new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-GB", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(date);
}

/** Ngày theo giờ Việt Nam ở dạng Date lúc 00:00 UTC, dùng làm khóa cho bảng thống kê theo ngày. */
export function vietnamDay(date: Date = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  return new Date(`${parts}T00:00:00.000Z`);
}
