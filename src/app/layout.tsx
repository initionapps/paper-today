import type { Metadata, Viewport } from "next";
import { Assistant, Rubik } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

import { SyncBanner } from "@/components/sync-banner";

/**
 * Inter and Manrope carry no Hebrew, so the UI runs on two families that do —
 * both with Latin and Hebrew drawn by the same hand, which is what keeps a
 * mixed line (a Hebrew task with a 9:30 on it) from looking spliced together.
 */
const assistant = Assistant({
  subsets: ["latin", "hebrew"],
  variable: "--font-assistant",
  display: "swap",
});

// geometric, a little forward-leaning — headings only
const rubik = Rubik({
  subsets: ["latin", "hebrew"],
  variable: "--font-rubik",
  display: "swap",
});

/**
 * The daily motto, and nothing else — a genuine Hebrew handwriting face,
 * licensed by the user (AlefAlefAlef's free-use terms; see the PDF shipped
 * with the source download, not committed here). One weight only, so unlike
 * the Google-served faces above there is no `weight`/`style` to request —
 * whatever the file contains is what renders.
 */
const danaYad = localFont({
  src: "./fonts/DanaYadAlefAlefAlef-Normal.woff",
  variable: "--font-quote-face",
  display: "swap",
});

export const metadata: Metadata = {
  title: "היום",
  description: "יום אחד, עמוד אחד.",
};

export const viewport: Viewport = {
  themeColor: "#f5f7fa",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="he"
      dir="rtl"
      className={`${assistant.variable} ${rubik.variable} ${danaYad.variable}`}
    >
      <body>
        {children}
        {/* Renders nothing until a write fails, so it costs the auth pages
            nothing to have it here — and it is here, at the root, because an
            unsaved change must be visible on whatever page it happened on. */}
        <SyncBanner />
      </body>
    </html>
  );
}
