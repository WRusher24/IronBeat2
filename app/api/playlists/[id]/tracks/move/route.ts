import type { NextRequest } from "next/server";

import { isSameOrigin, jsonError, jsonOk, zodMessage } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { moveTrackInPlaylist } from "@/lib/data";
import { reorderSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/** Reorders a track one slot up or down inside a playlist. */
export async function POST(request: NextRequest, context: RouteContext) {
  if (!isSameOrigin(request)) return jsonError("Forbidden", 403);

  const user = await getSessionUser();
  if (!user) return jsonError("Unauthorized", 401);

  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Expected a JSON body", 400);
  }

  const parsed = reorderSchema.safeParse(body);
  if (!parsed.success) return jsonError(zodMessage(parsed.error), 422);

  const ok = await moveTrackInPlaylist(
    user.id,
    id,
    parsed.data.trackId,
    parsed.data.direction,
  );

  if (!ok) return jsonError("Can't move that track", 400);

  return jsonOk({ ok: true });
}
