import type { NextRequest } from "next/server";

import { isSameOrigin, jsonError, jsonOk, zodMessage } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { listFavorites, toggleFavorite } from "@/lib/data";
import { payloadToRow } from "@/lib/track-mapping";
import { addTrackSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return jsonError("Unauthorized", 401);

  const tracks = await listFavorites(user.id);
  return jsonOk({ tracks });
}

/** Toggles a favourite and reports the resulting state. */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return jsonError("Forbidden", 403);

  const user = await getSessionUser();
  if (!user) return jsonError("Unauthorized", 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Expected a JSON body", 400);
  }

  const parsed = addTrackSchema.safeParse(body);
  if (!parsed.success) return jsonError(zodMessage(parsed.error), 422);

  const result = await toggleFavorite(user.id, payloadToRow(parsed.data.track));
  return jsonOk(result);
}
