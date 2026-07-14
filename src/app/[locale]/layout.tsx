import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import {
  getMessages,
  getTranslations,
  setRequestLocale,
} from "next-intl/server";
import { routing } from "@/i18n/routing";
import { SITE_URL } from "@/lib/seo";
import "../globals.css";
import { AuthProvider } from "@/features/auth/components/AuthProvider";
import { PreciosProvider } from "@/features/pricing/components/PreciosProvider";
import { GlobalErrorListener } from "@/features/observability/components/GlobalErrorListener";
import { InitialLoader } from "@/components/loaders/InitialLoader";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return {
    metadataBase: new URL(SITE_URL),
    title: t("rootTitle"),
    description: t("rootDesc"),
    manifest: "/manifest.webmanifest",
    icons: { icon: "/favicon.svg" },
    openGraph: {
      type: "website",
      siteName: "Only G Music",
      locale,
      title: t("rootTitle"),
      description: t("rootDesc"),
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
};

/** Pre-genera las rutas de cada idioma (SSG-friendly). */
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider messages={messages}>
          <AuthProvider>
            <PreciosProvider>
              <GlobalErrorListener />
              <InitialLoader />
              {children}
            </PreciosProvider>
          </AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
