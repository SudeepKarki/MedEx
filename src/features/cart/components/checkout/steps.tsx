import { CheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = ["Review", "Place orders", "Done"] as const;

/** "Step 2 of 3" with names, for a checkout that changes screens. */
export function CheckoutSteps({ current }: { current: 0 | 1 | 2 }) {
  return (
    <nav aria-label="Checkout progress">
      <ol className="flex items-center gap-2 text-sm">
        {STEPS.map((label, i) => {
          const done = i < current || (i === 2 && current === 2);
          return (
            <li
              key={label}
              className="flex items-center gap-2"
              aria-current={i === current ? "step" : undefined}
            >
              <span
                className={cn(
                  "flex size-6 items-center justify-center rounded-full border text-xs font-semibold",
                  done && "border-primary bg-primary text-primary-foreground",
                  i === current && !done && "border-primary text-primary",
                )}
              >
                {done ? <CheckIcon aria-hidden className="size-3.5" /> : i + 1}
              </span>
              <span className={cn(i === current ? "font-semibold" : "text-muted-foreground")}>
                {label}
                {done && <span className="sr-only"> (completed)</span>}
              </span>
              {i < STEPS.length - 1 && <span aria-hidden className="h-px w-6 bg-border sm:w-10" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
