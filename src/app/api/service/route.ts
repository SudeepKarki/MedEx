import { listServices } from "@/server/service-explorer/repository";
import { withMockControls } from "@/server/mock/with-mock-controls";

/**
 * Mirrors GET /service. Returns all 3,200 services in one response (~2 MB raw,
 * ~150 KB gzipped) because the explorer filters and counts facets on the
 * client; a little extra latency stands in for the bigger payload.
 */
export async function GET(request: Request) {
  return withMockControls(request, async () => Response.json({ data: await listServices() }), {
    extraLatencyMs: 300,
  });
}
