import type { MockEndpointDefinition } from "@/lib/mock-controls/protocol";

export const EXPLORER_ENDPOINTS = {
  categories: {
    id: "explorer.categories",
    label: "GET /api/category/active",
    failureKinds: [500, 503, "network", "timeout"],
  },
  providers: {
    id: "explorer.providers",
    label: "GET /api/providers",
    failureKinds: [500, 503, "network", "timeout"],
  },
  services: {
    id: "explorer.services",
    label: "GET /api/service",
    failureKinds: [500, 503, "network", "timeout"],
  },
} as const satisfies Record<string, MockEndpointDefinition>;

export const EXPLORER_ENDPOINT_LIST: readonly MockEndpointDefinition[] =
  Object.values(EXPLORER_ENDPOINTS);
