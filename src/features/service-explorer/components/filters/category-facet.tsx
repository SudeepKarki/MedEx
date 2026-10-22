import type { Facets } from "../../domain/engine";
import { toggleCategory, toggleValue, type ExplorerFilters } from "../../domain/filters";
import { SERVICE_TYPE_LABELS } from "../../domain/labels";
import { SERVICE_TYPES, type Catalog } from "../../domain/types";
import { FacetOption } from "./facet-option";
import { FacetSection } from "./facet-section";
import type { FilterChange } from "./types";

/**
 * Category → subcategory tree. Categories are grouped under their service
 * type, which is also what tells the two "Ultrasound" categories apart (a
 * package and a lab-test one; same slug, different type). Choosing a category
 * reveals its subcategories, which narrow within it.
 */
export function CategoryFacet({
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
  const groups = SERVICE_TYPES.map((type) => ({
    type,
    categories: catalog.categories.filter((c) => c.type === type),
  })).filter((g) => g.categories.length > 0);

  return (
    <FacetSection
      title="Category"
      onClear={
        filters.categories.length
          ? () => onChange({ ...filters, categories: [], subcategories: [], page: 1 })
          : undefined
      }
    >
      {groups.map(({ type, categories }) => (
        <div
          key={type}
          role="group"
          aria-labelledby={`category-group-${type}`}
          className="flex flex-col"
        >
          <p
            id={`category-group-${type}`}
            className="mt-2 mb-0.5 px-2 text-xs font-medium tracking-wide text-muted-foreground uppercase"
          >
            {SERVICE_TYPE_LABELS[type].plural}
          </p>
          {categories.map((category) => {
            const selected = filters.categories.includes(category.key);
            return (
              <div key={category.key}>
                <FacetOption
                  label={category.title}
                  count={facets.categories.get(category.key) ?? 0}
                  checked={selected}
                  onToggle={() => onChange(toggleCategory(filters, category.key))}
                />
                {selected && category.children.length > 0 && (
                  <div
                    role="group"
                    aria-label={`${category.title} subcategories`}
                    className="ml-5 border-l pl-2"
                  >
                    {category.children.map((sub) => (
                      <FacetOption
                        key={sub.key}
                        label={sub.title}
                        count={facets.subcategories.get(sub.key) ?? 0}
                        checked={filters.subcategories.includes(sub.key)}
                        onToggle={() =>
                          onChange({
                            ...filters,
                            subcategories: toggleValue(filters.subcategories, sub.key),
                            page: 1,
                          })
                        }
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </FacetSection>
  );
}
