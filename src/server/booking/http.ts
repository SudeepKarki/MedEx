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

/** "BK-YYYYMMDD-XXXX" like the fixture's id; never one that's already taken. */
export function newBookingId(date: string, taken: (id: string) => boolean): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (;;) {
    let suffix = "";
    for (let i = 0; i < 4; i++) suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
    const id = `BK-${date.replace(/-/g, "")}-${suffix}`;
    if (!taken(id)) return id;
  }
}

export const notFound = () => Response.json({ code: "NOT_FOUND", message: "Not found." }, { status: 404 });
