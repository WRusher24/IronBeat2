import type { NextRequest } from "next/server";

import { isSameOrigin, jsonError, jsonOk, zodMessage } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { createPlaylist, listPlaylists } from "@/lib/data";
import { rateLimit } from "@/lib/rate-limit";
import { createPlaylistSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return jsonError("Unauthorized", 401);

  const playlists = await listPlaylists(user.id);
  return jsonOk({ playlists });
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return jsonError("Forbidden", 403);

  const user = await getSessionUser();
  if (!user) return jsonError("Unauthorized", 401);

  const limit = rateLimit(`playlist-create:${user.id}`, 30, 10 * 60 * 1000);
  if (!limit.ok) return jsonError("Slow down a moment.", 429);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Expected a JSON body", 400);
  }

  const parsed = createPlaylistSchema.safeParse(body);
  if (!parsed.success) return jsonError(zodMessage(parsed.error), 422);

  const playlist = await createPlaylist(user.id, parsed.data);
  return jsonOk({ playlist }, { status: 201 });
}
