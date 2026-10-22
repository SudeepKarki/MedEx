import type { FilterUpdate } from "../../hooks/use-url-filters";

/**
 * Facets report changes as updaters, not finished objects: the desktop panel
 * applies them to the live URL, the mobile drawer to its draft. Either way the
 * change is computed from the latest state, never from a stale prop.
 */
export type FilterChange = (update: FilterUpdate) => void;
