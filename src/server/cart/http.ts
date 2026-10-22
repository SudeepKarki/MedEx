import "server-only";

import type { ApiResult } from "./checkout";

export function respond(result: ApiResult): Response {
  if (result.status === 204) return new Response(null, { status: 204 });
  return Response.json(result.body, { status: result.status });
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export const badRequest = (message: string) =>
  Response.json({ code: "BAD_REQUEST", message }, { status: 400 });

export function newLineId(): string {
  return crypto.randomUUID();
}

export function newOrderId(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I: read out over the phone
  let id = "MX-";
  for (let i = 0; i < 6; i++) id += alphabet[Math.floor(Math.random() * alphabet.length)];
  return id;
}
