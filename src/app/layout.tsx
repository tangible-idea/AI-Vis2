import type { Metadata, Viewport } from "next";
import { Instrument_Sans, Instrument_Serif, IBM_Plex_Mono } from "next/font/google";
import { I18nProvider } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";
import { LanguageSuggest } from "@/components/language-suggest";
import { CookieConsent } from "@/components/cookie-consent";
import { SITE } from "@/lib/seo";
import "./globals.css";

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  weight: ["400", "500"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: SITE.title,
    template: `%s · ${SITE.name}`,
  },
  description: SITE.description,
  applicationName: SITE.name,
  keywords: [
    "AI visibility monitoring",
    "AI search optimization",
    "AEO",
    "GEO",
    "brand visibility in AI",
    "ChatGPT brand monitoring",
    "AI SEO",
    "competitive AI visibility",
  ],
  openGraph: {
    type: "website",
    siteName: SITE.name,
    title: SITE.title,
    description: SITE.description,
    url: "/",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE.title,
    description: SITE.description,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: SITE.themeColor,
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  return (
    <html lang={locale}>
      <body
        className={`${instrumentSans.variable} ${instrumentSerif.variable} ${plexMono.variable} antialiased`}
      >
        <I18nProvider locale={locale}>
          {children}
          <LanguageSuggest />
          <CookieConsent />
        </I18nProvider>
      </body>
    </html>
  );
}
