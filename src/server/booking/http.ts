import "server-only";

import type { ApiResult } from "./logic";

export function respond(result: ApiResult): Response {
  return Response.json(result.body, { status: result.status });
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export function newBookingId(date: string): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (let i = 0; i < 4; i++) suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `BK-${date.replace(/-/g, "")}-${suffix}`;
}

export const notFound = () => Response.json({ code: "NOT_FOUND", message: "Not found." }, { status: 404 });
