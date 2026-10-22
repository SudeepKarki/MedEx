import type { Facets } from "../../domain/engine";
import type { ExplorerFilters } from "../../domain/filters";
import type { Catalog } from "../../domain/types";
import { CategoryFacet } from "./category-facet";
import { HomeTestFacet } from "./home-test-facet";
import { LocationFacet } from "./location-facet";
import { PriceFacet } from "./price-facet";
import { ProviderFacet } from "./provider-facet";
import { TypeFacet } from "./type-facet";
import type { FilterChange } from "./types";

export interface FilterPanelProps {
  filters: ExplorerFilters;
  facets: Facets;
  catalog: Catalog;
  onChange: FilterChange;
}

/**
 * Every facet, as a controlled component. The desktop sidebar binds it to the
 * URL (changes apply immediately); the mobile drawer binds it to a draft form
 * that's applied on "Show results".
 */
export function FilterPanel(props: FilterPanelProps) {
  return (
    <div className="flex flex-col gap-4">
      <LocationFacet {...props} />
      <TypeFacet {...props} />
      <PriceFacet {...props} />
      <CategoryFacet {...props} />
      <HomeTestFacet {...props} />
      <ProviderFacet {...props} />
    </div>
  );
}
