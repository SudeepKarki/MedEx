"use client";

import { SearchIcon, XIcon } from "lucide-react";
import { useId, useRef } from "react";
import { Button } from "@/components/ui/button";
import { MAX_QUERY_LENGTH } from "../domain/url-state";

/**
 * Free-text search across service titles, provider names and categories.
 * Controlled by local state only, so a keystroke never waits on filtering.
 */
export function SearchBox({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="relative w-full">
      <label htmlFor={id} className="sr-only">
        Search services, providers or categories
      </label>
      <SearchIcon
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground"
      />
      <input
        ref={inputRef}
        id={id}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape" && value) {
            e.preventDefault();
            onChange("");
          }
        }}
        placeholder="Search tests, check-ups, clinics…"
        autoComplete="off"
        // Same limit as the URL, so the box never gets cut back while typing
        maxLength={MAX_QUERY_LENGTH}
        spellCheck={false}
        enterKeyHint="search"
        className="h-12 w-full rounded-xl border border-input bg-card pr-12 pl-12 text-base shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-1/2 right-2 -translate-y-1/2"
          aria-label="Clear search"
          onClick={() => {
            onChange("");
            inputRef.current?.focus();
          }}
        >
          <XIcon aria-hidden />
        </Button>
      )}
    </div>
  );
}
