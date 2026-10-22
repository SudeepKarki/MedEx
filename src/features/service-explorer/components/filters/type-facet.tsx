import type { Facets } from "../../domain/engine";
import { toggleValue, type ExplorerFilters } from "../../domain/filters";
import { SERVICE_TYPE_LABELS } from "../../domain/labels";
import { SERVICE_TYPES } from "../../domain/types";
import { FacetOption } from "./facet-option";
import { FacetSection } from "./facet-section";
import type { FilterChange } from "./types";

export function TypeFacet({
  filters,
  facets,
  onChange,
}: {
  filters: ExplorerFilters;
  facets: Facets;
  onChange: FilterChange;
}) {
  return (
    <FacetSection
      title="Service type"
      onClear={
        filters.types.length ? () => onChange((f) => ({ ...f, types: [], page: 1 })) : undefined
      }
    >
      {SERVICE_TYPES.map((type) => (
        <FacetOption
          key={type}
          label={SERVICE_TYPE_LABELS[type].plural}
          count={facets.types.get(type) ?? 0}
          checked={filters.types.includes(type)}
          onToggle={() => onChange((f) => ({ ...f, types: toggleValue(f.types, type), page: 1 }))}
        />
      ))}
    </FacetSection>
  );
}
