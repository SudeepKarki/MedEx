import { Skeleton } from "@/components/ui/skeleton";
import { FiltersSkeleton, ResultsHeaderSkeleton, ResultsSkeleton } from "./skeletons";

/** Same layout as the explorer, used while the URL-dependent part streams in. */
export function ExplorerShellSkeleton() {
  return (
    <div
      className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pt-6 pb-28 sm:px-6 lg:pt-8"
      aria-busy="true"
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
            Find health services
          </h1>
          <p className="text-muted-foreground">
            Compare check-ups, lab tests and treatments from clinics, hospitals and labs in
            Thailand, Nepal and India.
          </p>
        </div>
        <Skeleton className="h-12 max-w-3xl rounded-xl" />
      </div>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <div className="hidden lg:block">
          <FiltersSkeleton />
        </div>
        <div className="flex flex-col gap-4">
          <ResultsHeaderSkeleton />
          <ResultsSkeleton />
        </div>
      </div>
    </div>
  );
}
