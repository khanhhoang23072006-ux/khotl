import "server-only";
import { getLocale } from "next-intl/server";
import { type AppLocale, toLocale } from "@/i18n/config";

export async function currentLocale(): Promise<AppLocale> {
  return toLocale(await getLocale());
}
