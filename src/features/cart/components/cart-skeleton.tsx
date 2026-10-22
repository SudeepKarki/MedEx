import { Skeleton } from "@/components/ui/skeleton";

export function CartSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]" aria-hidden>
      <div className="flex flex-col gap-4">
        {[3, 1, 2].map((rows, i) => (
          <div key={i} className="rounded-xl border bg-card">
            <div className="flex justify-between border-b p-5">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-6 w-28" />
            </div>
            <div className="flex flex-col gap-4 p-5">
              {Array.from({ length: rows }, (_, r) => (
                <div key={r} className="flex justify-between gap-4">
                  <div className="flex flex-1 flex-col gap-2">
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-3.5 w-1/3" />
                  </div>
                  <Skeleton className="h-9 w-28" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <Skeleton className="h-80 rounded-xl" />
    </div>
  );
}
