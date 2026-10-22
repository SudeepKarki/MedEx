import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface FacetSectionProps {
  title: string;
  /** Shown when the facet has a selection; clears just this facet. */
  onClear?: () => void;
  children: ReactNode;
  description?: ReactNode;
}

/** A labelled group of filter controls (fieldset + legend for screen readers). */
export function FacetSection({ title, onClear, children, description }: FacetSectionProps) {
  return (
    <fieldset className="flex min-w-0 flex-col gap-1 border-b pb-4 last:border-b-0">
      <div className="flex min-h-8 items-center justify-between gap-2">
        <legend className="float-left font-heading text-sm font-semibold">{title}</legend>
        {onClear && (
          <Button
            variant="ghost"
            size="xs"
            onClick={onClear}
            className="text-primary"
            aria-label={`Clear ${title.toLowerCase()} filter`}
          >
            Clear
          </Button>
        )}
      </div>
      {description && <div className="text-xs text-muted-foreground">{description}</div>}
      {children}
    </fieldset>
  );
}
