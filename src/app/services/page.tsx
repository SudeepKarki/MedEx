import type { Metadata } from "next";
import { Suspense } from "react";
import { ServiceExplorer } from "@/features/service-explorer/components/service-explorer";
import { ExplorerShellSkeleton } from "@/features/service-explorer/components/states/explorer-shell-skeleton";

export const metadata: Metadata = {
  title: "Find health services",
  description:
    "Browse and compare health packages, lab tests and wellness treatments from clinics, hospitals and labs.",
};

/**
 * The explorer reads its state from the URL (useSearchParams), so it renders
 * inside Suspense: the static shell prerenders the skeleton, never an
 * unfiltered list, and the real view streams in with the URL's filters.
 */
export default function ServicesPage() {
  return (
    <Suspense fallback={<ExplorerShellSkeleton />}>
      <ServiceExplorer />
    </Suspense>
  );
}
