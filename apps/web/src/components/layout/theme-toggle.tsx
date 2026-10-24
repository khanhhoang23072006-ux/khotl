"use client";

import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { MoonIcon, SunIcon } from "@/components/icons";

/** Nút đổi nền sáng/tối. Chỉ hiện biểu tượng sau khi mount để tránh lệch HTML lúc hydrate. */
export function ThemeToggle() {
  const t = useTranslations("common");
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const dark = mounted && resolvedTheme === "dark";
  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? "light" : "dark")}
      className="flex h-11 w-11 items-center justify-center hover:bg-wash"
      aria-label={dark ? t("themeLight") : t("themeDark")}
      title={dark ? t("themeLight") : t("themeDark")}
    >
      {mounted ? dark ? <SunIcon /> : <MoonIcon /> : <span className="h-5 w-5" />}
    </button>
  );
}
