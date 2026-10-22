import type { Metadata, Viewport } from "next";
import { Figtree, Geist_Mono } from "next/font/google";
import { LiveAnnouncer } from "@/components/app/live-announcer";
import { AppProviders } from "@/components/app/providers";
import { SiteHeader } from "@/components/app/site-header";
import { SkipLink } from "@/components/app/skip-link";
import { CheckoutRunner } from "@/features/cart/components/checkout-runner";
import "./globals.css";

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "MedEx", template: "%s · MedEx" },
  description: "Find, compare and book clinics, hospitals and labs in Thailand, Nepal and India.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#020618" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // next-themes sets the class on <html> before hydration
    <html
      lang="en"
      suppressHydrationWarning
      className={`${figtree.variable} ${geistMono.variable}`}
    >
      <body className="flex min-h-dvh flex-col antialiased">
        <AppProviders>
          <SkipLink />
          <SiteHeader />
          <main id="main" tabIndex={-1} className="flex flex-1 flex-col outline-none">
            {children}
          </main>
          <LiveAnnouncer />
          {/* Keeps an in-progress checkout moving on every page */}
          <CheckoutRunner />
        </AppProviders>
      </body>
    </html>
  );
}
