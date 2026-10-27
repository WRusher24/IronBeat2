import type { NextRequest } from "next/server";

import { isSameOrigin, jsonError, jsonOk, zodMessage } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { deletePlaylist, getPlaylist, updatePlaylist } from "@/lib/data";
import { updatePlaylistSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) return jsonError("Unauthorized", 401);

  const { id } = await context.params;
  const playlist = await getPlaylist(user.id, id);

  if (!playlist) return jsonError("Playlist not found", 404);

  return jsonOk({ playlist });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
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

  const parsed = updatePlaylistSchema.safeParse(body);
  if (!parsed.success) return jsonError(zodMessage(parsed.error), 422);

  const ok = await updatePlaylist(user.id, id, parsed.data);
  if (!ok) return jsonError("Playlist not found", 404);

  return jsonOk({ ok: true });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  if (!isSameOrigin(request)) return jsonError("Forbidden", 403);

  const user = await getSessionUser();
  if (!user) return jsonError("Unauthorized", 401);

  const { id } = await context.params;
  const ok = await deletePlaylist(user.id, id);

  if (!ok) return jsonError("Playlist not found", 404);

  return jsonOk({ ok: true });
}
