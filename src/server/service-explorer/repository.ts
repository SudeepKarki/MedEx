import "server-only";

import { loadDataFile } from "@/server/mock/load-json";

/**
 * In-memory "database" for the Service Explorer. Returns records exactly as
 * the fixture stores them (rough edges included): cleaning them up is the
 * client's job, as it would be against the production API.
 */
interface ServiceExplorerFixture {
  categories: unknown[];
  providers: unknown[];
  services: unknown[];
}

async function fixture(): Promise<ServiceExplorerFixture> {
  const data = (await loadDataFile("task1-service-explorer.json")) as ServiceExplorerFixture;
  return data;
}

export async function listActiveCategories(): Promise<unknown[]> {
  return (await fixture()).categories;
}

export async function listProviders(): Promise<unknown[]> {
  return (await fixture()).providers;
}

export async function listServices(): Promise<unknown[]> {
  return (await fixture()).services;
}
