import type { Facets } from "../../domain/engine";
import { toggleCity, toggleCountry, type ExplorerFilters } from "../../domain/filters";
import type { Catalog } from "../../domain/types";
import { FacetOption } from "./facet-option";
import { FacetSection } from "./facet-section";
import type { FilterChange } from "./types";

/** Country → city tree. A checked country includes all its cities. */
export function LocationFacet({
  filters,
  facets,
  catalog,
  onChange,
}: {
  filters: ExplorerFilters;
  facets: Facets;
  catalog: Catalog;
  onChange: FilterChange;
}) {
  const active = filters.countries.length > 0 || filters.cities.length > 0;
  return (
    <FacetSection
      title="Location"
      onClear={
        active ? () => onChange((f) => ({ ...f, countries: [], cities: [], page: 1 })) : undefined
      }
    >
      {catalog.countries.map((country) => {
        const countrySelected = filters.countries.includes(country.code);
        const someCities = country.cities.some((c) => filters.cities.includes(c.key));
        const cityKeys = country.cities.map((c) => c.key);
        return (
          <div key={country.code} role="group" aria-label={country.name}>
            <FacetOption
              label={<span className="font-medium">{country.name}</span>}
              count={facets.countries.get(country.code) ?? 0}
              checked={countrySelected ? true : someCities ? "indeterminate" : false}
              onToggle={() => onChange((f) => toggleCountry(f, country.code))}
            />
            <div className="ml-5 border-l pl-2">
              {country.cities.map((city) => (
                <FacetOption
                  key={city.key}
                  label={city.name}
                  count={facets.cities.get(city.key) ?? 0}
                  checked={countrySelected || filters.cities.includes(city.key)}
                  onToggle={() => onChange((f) => toggleCity(f, city.key, cityKeys))}
                />
              ))}
            </div>
          </div>
        );
      })}
    </FacetSection>
  );
}
