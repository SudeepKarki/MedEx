import { Skeleton } from "@/components/ui/skeleton";

/** Shaped like a real provider card with three services, so nothing jumps when data lands. */
export function ProviderCardSkeleton() {
  return (
    <div className="flex flex-col rounded-xl border bg-card shadow-xs" aria-hidden>
      <div className="flex items-start gap-3 p-4 pb-2 sm:p-5 sm:pb-2">
        <Skeleton className="size-11 rounded-lg" />
        <div className="flex flex-1 flex-col gap-2 pt-0.5">
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-4 w-2/3" />
        </div>
        <Skeleton className="h-5 w-20" />
      </div>
      <div className="px-4 sm:px-5">
        <Skeleton className="h-4 w-36" />
      </div>
      <div className="divide-y px-4 sm:px-5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-start justify-between gap-4 py-3">
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-3/5" />
              <Skeleton className="h-3.5 w-2/5" />
            </div>
            <div className="flex flex-col items-end gap-2">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        ))}
      </div>
      <div className="border-t px-3 py-2.5">
        <Skeleton className="mx-auto h-5 w-48" />
      </div>
    </div>
  );
}

export function ResultsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-4">
      {Array.from({ length: count }, (_, i) => (
        <ProviderCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function FiltersSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-hidden>
      {[6, 5, 4, 7].map((rows, s) => (
        <div key={s} className="flex flex-col gap-3 border-b pb-4">
          <Skeleton className="h-4 w-24" />
          {Array.from({ length: rows }, (_, i) => (
            <div key={i} className="flex items-center gap-3 px-2">
              <Skeleton className="size-4 rounded-sm" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-3 w-8" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function ResultsHeaderSkeleton() {
  return (
    <div className="flex items-center justify-between gap-4" aria-hidden>
      <Skeleton className="h-7 w-64" />
      <Skeleton className="h-9 w-44" />
    </div>
  );
}
