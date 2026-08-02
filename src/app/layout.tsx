import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "L-Split — shared meal & expense manager",
  description:
    "Manage shared meals, market duties, expenses and monthly billing for your mess or shared household.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* IBM Plex: Sans for the UI, Mono for financial figures.
            Loaded from Google Fonts with graceful system fallbacks
            (see fontFamily in tailwind.config.ts). */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
