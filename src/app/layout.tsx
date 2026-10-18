import type { Metadata, Viewport } from "next";
import { Inter, Noto_Sans_Devanagari, Geist_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const notoDevanagari = Noto_Sans_Devanagari({
  variable: "--font-devanagari",
  subsets: ["devanagari", "latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "DukaanAI — Talk to your shop. DukaanAI keeps the books.",
  description:
    "Voice-first Hinglish AI co-pilot for Indian kirana store owners. Speech and photos become ledger entries, stock updates, GST invoices and WhatsApp payment reminders.",
  keywords: [
    "kirana",
    "AI",
    "ledger",
    "voice",
    "Hindi",
    "Hinglish",
    "invoice",
    "udhar",
    "bahi khata",
    "HackIndia",
  ],
  authors: [{ name: "DukaanAI Team" }],
  creator: "DukaanAI",
  openGraph: {
    type: "website",
    locale: "hi_IN",
    url: "https://dukaanai.in",
    title: "DukaanAI — Talk to your shop. DukaanAI keeps the books.",
    description:
      "Voice-first Hinglish AI co-pilot for Indian kirana store owners. Speech and photos become ledger entries, stock updates, GST invoices and WhatsApp payment reminders.",
    siteName: "DukaanAI",
  },
  twitter: {
    card: "summary_large_image",
    title: "DukaanAI — Talk to your shop. DukaanAI keeps the books.",
    description:
      "Voice-first Hinglish AI co-pilot for Indian kirana store owners. Speech and photos become ledger entries, stock updates, GST invoices and WhatsApp payment reminders.",
  },
  icons: {
    icon: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#070611",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="hi"
      className={`${inter.variable} ${notoDevanagari.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
