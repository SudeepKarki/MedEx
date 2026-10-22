"use client";

import { ClipboardListIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { DataIssue, DataIssueCode } from "../domain/types";

/** In order of how much they matter to a customer. */
const GROUPS: Record<DataIssueCode, string> = {
  "negative-price": "Prices that would be negative",
  "unparseable-price": "Prices we couldn't read",
  "no-wellness-options": "Wellness services without durations",
  "title-whitespace": "Titles with stray spaces",
  "category-inactive": "Hidden: switched-off categories",
  "provider-inactive": "Hidden: inactive providers",
  "service-disabled": "Hidden: switched-off services",
  "provider-unknown": "Hidden: unknown provider",
  "category-unknown": "Hidden: unknown category",
  "subcategory-mismatch": "Subcategory under the wrong parent",
  "no-category": "Services without a category",
  "no-rating": "Providers without reviews",
  "provider-slug-mismatch": "Inconsistent provider slugs",
  "provider-empty": "Providers with nothing to show",
  "home-test-fee-missing": "Home tests without a fee",
  "invalid-record": "Unreadable records",
};

/**
 * For reviewers: every data-quality decision the catalog builder made, as
 * recorded at load time. Customers never need this; it's here so the decisions
 * in the README can be checked against what actually happened.
 */
export function DataReport({ issues }: { issues: DataIssue[] }) {
  const grouped = new Map<DataIssueCode, DataIssue[]>();
  for (const issue of issues) {
    const list = grouped.get(issue.code) ?? [];
    list.push(issue);
    grouped.set(issue.code, list);
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="link" size="sm" className="text-muted-foreground">
          <ClipboardListIcon aria-hidden />
          Data quality report ({issues.length})
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Data quality report</DialogTitle>
          <DialogDescription>
            What the explorer found in the provider-entered data and what it did about each.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-5">
          {(Object.keys(GROUPS) as DataIssueCode[])
            .flatMap((code) => {
              const list = grouped.get(code);
              return list ? [[code, list] as const] : [];
            })
            .map(([code, list]) => (
              <section key={code} aria-labelledby={`issue-${code}`}>
                <h3 id={`issue-${code}`} className="mb-2 text-sm font-semibold">
                  {GROUPS[code]} <span className="text-muted-foreground">({list.length})</span>
                </h3>
                <ul className="flex flex-col gap-2 text-sm">
                  {list.map((issue, i) => (
                    <li key={`${issue.id}-${i}`} className="rounded-md border bg-muted/40 p-2.5">
                      <p className="font-medium break-words">{issue.label}</p>
                      <p className="text-muted-foreground">{issue.detail}</p>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
