import type { NextRequest } from "next/server";

import { jsonError, jsonOk } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { searchTracks } from "@/lib/audio/search";
import { recordSearch } from "@/lib/data";
import { rateLimit } from "@/lib/rate-limit";
import { searchQuerySchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Unified audio search across every configured source.
 *
 * GET /api/search?q=brazilian%20phonk&limit=24
 */
export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return jsonError("Sign in to search", 401);
  }

  const limit = rateLimit(`search:${user.id}`, 90, 60 * 1000);
  if (!limit.ok) {
    return jsonError("You're searching fast. Give it a second.", 429, {
      retryAfter: limit.retryAfterSeconds,
    });
  }

  const rawQuery = request.nextUrl.searchParams.get("q") ?? "";
  const parsedQuery = searchQuerySchema.safeParse(rawQuery);

  if (!parsedQuery.success) {
    return jsonError(parsedQuery.error.issues[0]?.message ?? "Invalid query", 422);
  }

  const rawLimit = Number(request.nextUrl.searchParams.get("limit") ?? 24);
  const resultLimit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(Math.trunc(rawLimit), 1), 50)
    : 24;

  const query = parsedQuery.data;
  const startedAt = Date.now();

  try {
    const result = await searchTracks(query, { limit: resultLimit });

    // Only remember searches that actually produced audio — a chip that
    // replays an empty query is friction, not a shortcut.
    if (result.tracks.length > 0) {
      void recordSearch(user.id, query, result.tracks.length).catch(() => undefined);
    }

    return jsonOk({
      query,
      tracks: result.tracks,
      sources: result.sources,
      tookMs: Date.now() - startedAt,
    });
  } catch (error) {
    console.error("[search] failed", error);
    return jsonError("The audio sources are unreachable right now.", 502);
  }
}
