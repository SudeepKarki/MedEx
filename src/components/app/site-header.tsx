import { HeartPulseIcon } from "lucide-react";
import Link from "next/link";
import { MockPanel } from "@/components/dev/mock-panel";
import { OfflineBanner } from "./offline-banner";
import { ThemeToggle } from "./theme-toggle";

/** Each task branch adds its own entry point here. */
const NAV_LINKS: { href: string; label: string }[] = [
  { href: "/services", label: "Find services" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
      <OfflineBanner />
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-md font-heading text-lg font-bold tracking-tight text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <HeartPulseIcon aria-hidden className="size-6 text-primary" />
          MedEx
        </Link>
        {NAV_LINKS.length > 0 && (
          <nav aria-label="Main" className="flex items-center gap-1 text-sm font-medium">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-md px-3 py-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        )}
        <div className="ml-auto flex items-center gap-1">
          <MockPanel />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
