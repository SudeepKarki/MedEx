import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface FacetSectionProps {
  title: string;
  /** Shown when the facet has a selection; clears just this facet. */
  onClear?: () => void;
  children: ReactNode;
  description?: ReactNode;
}

/**
 * A labelled group of filter controls. The <legend> must be the fieldset's
 * first direct child to give the group its accessible name ("Service type,
 * group"), so it's floated for layout instead of wrapped.
 */
export function FacetSection({ title, onClear, children, description }: FacetSectionProps) {
  return (
    <fieldset className="relative min-w-0 border-b pb-4 last:border-b-0">
      <legend className="float-left flex min-h-8 w-full items-center pr-16 font-heading text-sm font-semibold">
        {title}
      </legend>
      {onClear && (
        <Button
          variant="ghost"
          size="xs"
          onClick={onClear}
          className="absolute top-1 right-0 text-primary"
          aria-label={`Clear ${title.toLowerCase()} filter`}
        >
          Clear
        </Button>
      )}
      <div className="clear-left flex flex-col gap-1">
        {description && <div className="text-xs text-muted-foreground">{description}</div>}
        {children}
      </div>
    </fieldset>
  );
}
