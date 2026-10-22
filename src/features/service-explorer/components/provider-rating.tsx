import { StarIcon } from "lucide-react";
import { formatCount } from "@/lib/money";
import type { Provider } from "../domain/types";

export function ProviderRating({ provider }: { provider: Provider }) {
  if (provider.rating === null) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium text-muted-foreground">
        New on MedEx · no reviews yet
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-sm">
      <span className="sr-only">
        Rated {provider.rating.toFixed(1)} out of 5 from {formatCount(provider.reviewCount)} reviews
      </span>
      <StarIcon aria-hidden className="size-4 fill-rating text-rating" />
      <span aria-hidden className="font-semibold tabular-nums">
        {provider.rating.toFixed(1)}
      </span>
      <span aria-hidden className="text-muted-foreground tabular-nums">
        ({formatCount(provider.reviewCount)})
      </span>
    </span>
  );
}
