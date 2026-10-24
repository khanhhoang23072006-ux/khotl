import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Providers } from "@/components/layout/providers";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import "./globals.css";

// Archivo có trục độ rộng (wdth 62–125): dùng bản hẹp cho mã học phần và tiêu đề.
const archivo = Archivo({
  subsets: ["latin", "vietnamese"],
  axes: ["wdth"],
  variable: "--font-archivo",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return {
    metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
    title: { default: t("title"), template: `%s | ${t("short")}` },
    description: t("description"),
    applicationName: t("short"),
    openGraph: { type: "website", siteName: t("title"), locale: "vi_VN" },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f7f5" },
    { media: "(prefers-color-scheme: dark)", color: "#121518" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale} className={archivo.variable} suppressHydrationWarning>
      <body className="min-h-dvh">
        <NextIntlClientProvider>
          <Providers>
            <SiteHeader />
            <main id="noi-dung" className="min-h-[60vh]">
              {children}
            </main>
            <SiteFooter />
            <MobileNav />
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
