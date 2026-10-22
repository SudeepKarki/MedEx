import type { ExplorerFilters } from "../../domain/filters";

export type FilterChange = (next: ExplorerFilters) => void;
