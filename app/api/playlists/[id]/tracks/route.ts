import type { NextRequest } from "next/server";

import { isSameOrigin, jsonError, jsonOk, zodMessage } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { addTrackToPlaylist, removeTrackFromPlaylist } from "@/lib/data";
import { payloadToRow } from "@/lib/track-mapping";
import { addTrackSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/** Adds a track snapshot to a playlist. */
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

  const parsed = addTrackSchema.safeParse(body);
  if (!parsed.success) return jsonError(zodMessage(parsed.error), 422);

  const result = await addTrackToPlaylist(user.id, id, payloadToRow(parsed.data.track));

  if (result === "not_found") return jsonError("Playlist not found", 404);
  if (result === "duplicate") {
    return jsonOk({ status: "duplicate", message: "Already in this playlist" });
  }

  return jsonOk({ status: "added" }, { status: 201 });
}

/** Removes a track. DELETE /api/playlists/:id/tracks?trackId=... */
export async function DELETE(request: NextRequest, context: RouteContext) {
  if (!isSameOrigin(request)) return jsonError("Forbidden", 403);

  const user = await getSessionUser();
  if (!user) return jsonError("Unauthorized", 401);

  const { id } = await context.params;
  const trackId = request.nextUrl.searchParams.get("trackId");

  if (!trackId) return jsonError("trackId is required", 422);

  const ok = await removeTrackFromPlaylist(user.id, id, trackId);
  if (!ok) return jsonError("Track not found in playlist", 404);

  return jsonOk({ ok: true });
}
