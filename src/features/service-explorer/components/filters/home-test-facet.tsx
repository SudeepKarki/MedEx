import type { Facets } from "../../domain/engine";
import type { ExplorerFilters } from "../../domain/filters";
import { FacetOption } from "./facet-option";
import { FacetSection } from "./facet-section";
import type { FilterChange } from "./types";

export function HomeTestFacet({
  filters,
  facets,
  onChange,
}: {
  filters: ExplorerFilters;
  facets: Facets;
  onChange: FilterChange;
}) {
  return (
    <FacetSection title="Convenience">
      <FacetOption
        label="Available as a home test"
        count={facets.homeTest}
        checked={filters.homeTest}
        onToggle={() => onChange((f) => ({ ...f, homeTest: !f.homeTest, page: 1 }))}
      />
    </FacetSection>
  );
}
