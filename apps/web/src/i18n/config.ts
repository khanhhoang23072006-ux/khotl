export const LOCALES = ["vi", "en"] as const;
export type AppLocale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: AppLocale = "vi";
export const LOCALE_COOKIE = "locale";

export function toLocale(value: string | undefined | null): AppLocale {
  return value === "en" ? "en" : "vi";
}
