import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import type { ExplorerFilters } from "../domain/filters";
import { serializeFilters } from "../domain/url-state";

/** Page numbers to show: first, last, and a window around the current page. */
export function pageWindow(page: number, total: number): (number | "gap")[] {
  const pages = new Set([1, total, page - 1, page, page + 1].filter((p) => p >= 1 && p <= total));
  const sorted = [...pages].sort((a, b) => a - b);
  const result: (number | "gap")[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1]! > 1) result.push("gap");
    result.push(p);
  });
  return result;
}

/**
 * Real links (shareable, open-in-new-tab, work without JS). Clicks are
 * intercepted to update the URL in place and move focus to the results.
 */
export function ResultsPagination({
  filters,
  page,
  totalPages,
  pathname,
  onNavigate,
}: {
  filters: ExplorerFilters;
  page: number;
  totalPages: number;
  pathname: string;
  onNavigate: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  const href = (p: number) => {
    const query = serializeFilters({ ...filters, page: p });
    return query ? `${pathname}?${query}` : pathname;
  };
  const link = (p: number, children: React.ReactNode, label: string, current = false) => (
    <Link
      href={href(p)}
      scroll={false}
      aria-label={label}
      aria-current={current ? "page" : undefined}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
        event.preventDefault();
        onNavigate(p);
      }}
      className={cn(
        buttonVariants({ variant: current ? "default" : "ghost", size: "default" }),
        "min-w-9 tabular-nums",
      )}
    >
      {children}
    </Link>
  );

  return (
    <nav aria-label="Results pages" className="flex justify-center">
      <ul className="flex flex-wrap items-center gap-1">
        {page > 1 && (
          <li>
            {link(
              page - 1,
              <>
                <ChevronLeftIcon aria-hidden /> Previous
              </>,
              "Previous page",
            )}
          </li>
        )}
        {pageWindow(page, totalPages).map((p, i) =>
          p === "gap" ? (
            <li key={`gap-${i}`} aria-hidden className="px-1 text-muted-foreground">
              …
            </li>
          ) : (
            <li key={p}>
              {link(p, p, `Page ${p}${p === page ? ", current page" : ""}`, p === page)}
            </li>
          ),
        )}
        {page < totalPages && (
          <li>
            {link(
              page + 1,
              <>
                Next <ChevronRightIcon aria-hidden />
              </>,
              "Next page",
            )}
          </li>
        )}
      </ul>
    </nav>
  );
}
