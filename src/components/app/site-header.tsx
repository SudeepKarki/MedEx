import Link from "next/link";
import { MockPanel } from "@/components/dev/mock-panel";
import { CartNavLink } from "@/features/cart/components/cart-nav-link";
import { MainNavLinks, type NavLink } from "./main-nav";
import { MedExLogo } from "./medex-logo";
import { OfflineBanner } from "./offline-banner";
import { ThemeToggle } from "./theme-toggle";

/** Each task branch adds its own entry point here. */
const NAV_LINKS: NavLink[] = [
  { href: "/services", label: "Find services" },
  { href: "/book", label: "Book" },
];

export function SiteHeader() {
  return (
    <>
      {/* medex.co's sticky bar: the brand gradient with a white wordmark and links */}
      <header className="sticky top-0 z-30 bg-brand-gradient text-white shadow-[0_6px_20px_-10px_rgb(70_20_90/0.55)]">
        <OfflineBanner />
        <div className="page-container flex h-16 items-center gap-6">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-white/70"
          >
            {/* The full-colour wordmark would vanish on purple, so it's drawn in white */}
            <MedExLogo className="h-11 rounded-md bg-white/80 md:h-12" />
            <span className="sr-only">MedEx</span>
          </Link>
          {NAV_LINKS.length > 0 && (
            <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
              <MainNavLinks links={NAV_LINKS} tone="on-brand" />
            </nav>
          )}
          <div className="ml-auto flex items-center gap-1.5">
            <CartNavLink />
            <MockPanel />
            <ThemeToggle />
          </div>
        </div>
      </header>
      {/* Phones: with all three exercises there's no room in the bar, so the links get
          their own row. It scrolls away with the page, so the sticky bar stays 64 px
          and headings' scroll margins still clear it. Only one of the two navs is
          ever displayed, so screen readers find a single "Main" landmark. */}
      {NAV_LINKS.length > 0 && (
        <nav aria-label="Main" className="border-b bg-accent md:hidden">
          <div className="page-container flex gap-1 overflow-x-auto py-1.5 text-sm">
            <MainNavLinks links={NAV_LINKS} tone="on-surface" />
          </div>
        </nav>
      )}
    </>
  );
}
