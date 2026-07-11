import type { Metadata } from "next";
import { Instrument_Sans, Instrument_Serif, IBM_Plex_Mono } from "next/font/google";
import { I18nProvider } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";
import { LanguageSuggest } from "@/components/language-suggest";
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
  title: {
    default: "Sightline — AI Visibility Intelligence",
    template: "%s · Sightline",
  },
  description:
    "See how your brand shows up across ChatGPT, Claude, Gemini and Perplexity — and get concrete actions to improve it.",
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
        </I18nProvider>
      </body>
    </html>
  );
}
