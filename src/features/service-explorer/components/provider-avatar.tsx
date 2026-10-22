import { cn } from "@/lib/utils";

// Pairs chosen for ≥ 4.5:1 text contrast in both themes.
const PALETTE = [
  "bg-cyan-100 text-cyan-900 dark:bg-cyan-950 dark:text-cyan-200",
  "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200",
  "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  "bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200",
  "bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-200",
];

export function ProviderAvatar({
  id,
  name,
  className,
}: {
  id: number;
  name: string;
  className?: string;
}) {
  const initials = name
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w))
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-11 shrink-0 items-center justify-center rounded-lg font-heading text-sm font-bold",
        PALETTE[id % PALETTE.length],
        className,
      )}
    >
      {initials}
    </span>
  );
}
