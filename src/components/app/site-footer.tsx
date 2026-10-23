import Link from "next/link";

const EXPLORE = [
  { href: "/services", label: "Find services" },
  { href: "/cart", label: "Your cart" },
  { href: "/book", label: "Book an appointment" },
];

const PHOTOGRAPHERS = [
  { name: "National Cancer Institute", handle: "nci" },
  { name: "Mockup Graphics", handle: "mockupgraphics" },
  { name: "Testalize.me", handle: "testalizeme" },
  { name: "Towfiqu barbhuiya", handle: "towfiqu999999" },
];

const linkClass =
  "rounded-sm text-muted-foreground transition-colors outline-none hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50";
// Links inside a sentence need more than colour to stand out
const inlineLinkClass = `${linkClass} underline decoration-border underline-offset-3 hover:decoration-primary`;

/** medex.co's footer: the wordmark and links on white, then a purple copyright strip. */
export function SiteFooter() {
  return (
    <footer className="mt-auto border-t bg-card">
      <div className="page-container grid gap-8 py-10 text-sm sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1.5fr]">
        <div className="flex flex-col gap-3">
          {/* Text, not a second copy of the animated logo: one loop on screen is enough */}
          <p className="font-heading text-2xl font-extrabold tracking-tight">
            <span className="gradient-text">MedEx</span>
          </p>
          <p className="max-w-sm text-muted-foreground">
            Find, compare and book clinics, hospitals and labs in Thailand, Nepal and India.
          </p>
        </div>
        <nav aria-label="Footer" className="flex flex-col gap-3">
          <h2 className="font-heading text-xs font-bold tracking-wider uppercase">Explore</h2>
          <ul className="flex flex-col gap-2">
            {EXPLORE.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className={linkClass}>
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex flex-col gap-3">
          <h2 className="font-heading text-xs font-bold tracking-wider uppercase">Photos</h2>
          <p className="text-muted-foreground">
            From{" "}
            <a href="https://unsplash.com" className={inlineLinkClass}>
              Unsplash
            </a>
            , by{" "}
            {PHOTOGRAPHERS.map((p, i) => (
              <span key={p.handle}>
                <a href={`https://unsplash.com/@${p.handle}`} className={inlineLinkClass}>
                  {p.name}
                </a>
                {i < PHOTOGRAPHERS.length - 2
                  ? ", "
                  : i === PHOTOGRAPHERS.length - 2
                    ? " and "
                    : "."}
              </span>
            ))}
          </p>
        </div>
      </div>
      <div className="bg-primary text-primary-foreground dark:bg-brand-gradient dark:text-white">
        <p className="page-container py-3 text-center text-xs font-medium">
          MedEx take-home exercises · Senior Frontend Engineer
        </p>
      </div>
    </footer>
  );
}
