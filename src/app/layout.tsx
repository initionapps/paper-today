import type { Metadata, Viewport } from "next";
import { Assistant, Gveret_Levin, Rubik } from "next/font/google";
import "./globals.css";

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
 * The daily motto, and nothing else. A genuine Hebrew handwriting face — one
 * weight only (400), so the line must not ask for a lighter one.
 */
const gveretLevin = Gveret_Levin({
  subsets: ["latin", "hebrew"],
  weight: "400",
  variable: "--font-hand-face",
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
      className={`${assistant.variable} ${rubik.variable} ${gveretLevin.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
