import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "AirAlly — Smog-Smart Daily Plans",
  description: "Personalised low-emission routines, indoor air hacks, and sustainable swaps with deterministic air-quality impact.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
