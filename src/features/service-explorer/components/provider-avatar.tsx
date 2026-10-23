import { cn } from "@/lib/utils";

// Pairs chosen for ≥ 4.5:1 text contrast in both themes.
// Hues from medex.co's palette (plum, magenta, violet, orange) plus two calm neutrals of it.
const PALETTE = [
  "bg-purple-100 text-purple-900 dark:bg-purple-950 dark:text-purple-200",
  "bg-fuchsia-100 text-fuchsia-900 dark:bg-fuchsia-950 dark:text-fuchsia-200",
  "bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-200",
  "bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-200",
  "bg-pink-100 text-pink-900 dark:bg-pink-950 dark:text-pink-200",
  "bg-teal-100 text-teal-900 dark:bg-teal-950 dark:text-teal-200",
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
