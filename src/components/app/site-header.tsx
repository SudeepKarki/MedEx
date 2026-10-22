import { HeartPulseIcon } from "lucide-react";
import Link from "next/link";
import { MockPanel } from "@/components/dev/mock-panel";
import { CartNavLink } from "@/features/cart/components/cart-nav-link";
import { OfflineBanner } from "./offline-banner";
import { ThemeToggle } from "./theme-toggle";

/** Each task branch adds its own entry point here. */
const NAV_LINKS: { href: string; label: string }[] = [
  { href: "/services", label: "Find services" },
  { href: "/book", label: "Book" },
];

const linkClass =
  "shrink-0 rounded-md px-3 py-2 text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50";

export function SiteHeader() {
  return (
    <>
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
            <nav aria-label="Main" className="hidden items-center gap-1 text-sm font-medium md:flex">
              {NAV_LINKS.map((link) => (
                <Link key={link.href} href={link.href} className={linkClass}>
                  {link.label}
                </Link>
              ))}
            </nav>
          )}
          <div className="ml-auto flex items-center gap-1">
            <CartNavLink />
            <MockPanel />
            <ThemeToggle />
          </div>
        </div>
      </header>
      {/* Phones: with all three exercises there's no room in the bar, so the links get
          their own row. It scrolls away with the page, so the sticky bar stays 56 px
          and headings' scroll margins still clear it. Only one of the two navs is
          ever displayed, so screen readers find a single "Main" landmark. */}
      {NAV_LINKS.length > 0 && (
        <nav aria-label="Main" className="border-b bg-background md:hidden">
          <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-2 py-1 text-sm font-medium">
            {NAV_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className={linkClass}>
                {link.label}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </>
  );
}
