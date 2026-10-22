"use client";

import { RefreshCwIcon, TriangleAlertIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

/**
 * Last-resort boundary for unexpected render errors: the customer gets a calm
 * explanation and a way to recover instead of a blank "page couldn't load".
 */
export default function RouteError({ error, retry }: { error: unknown; retry: () => void }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    console.error(error); // where an error-reporting service would hook in
    headingRef.current?.focus();
  }, [error]);

  return (
    <div
      role="alert"
      className="mx-auto my-16 flex max-w-md flex-col items-center gap-4 px-4 text-center"
    >
      <TriangleAlertIcon aria-hidden className="size-10 text-muted-foreground" />
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="font-heading text-2xl font-semibold outline-none"
      >
        Something went wrong
      </h1>
      <p className="text-muted-foreground">
        This page hit an unexpected problem. Trying again usually fixes it.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button size="lg" onClick={() => retry()}>
          <RefreshCwIcon aria-hidden />
          Try again
        </Button>
        <Button size="lg" variant="outline" asChild>
          <Link href="/">Go to the home page</Link>
        </Button>
      </div>
    </div>
  );
}
