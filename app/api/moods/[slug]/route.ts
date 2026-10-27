import type { NextRequest } from "next/server";

import { jsonError, jsonOk } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { searchSeeds } from "@/lib/audio/search";
import { getMood } from "@/lib/moods";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ slug: string }> };

/**
 * Expands a mood into a fresh dynamic playlist.
 * GET /api/moods/phonk-hype
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) return jsonError("Unauthorized", 401);

  const limit = rateLimit(`mood:${user.id}`, 60, 60 * 1000);
  if (!limit.ok) return jsonError("One vibe at a time.", 429);

  const { slug } = await context.params;
  const mood = getMood(slug);

  if (!mood) return jsonError("Unknown mood", 404);

  const seeds = [...mood.seeds, ...(mood.fallbackSeeds ?? [])].slice(0, 5);

  try {
    const result = await searchSeeds(seeds, { perSeed: 9, total: 30 });

    return jsonOk({
      mood: {
        slug: mood.slug,
        emoji: mood.emoji,
        title: mood.title,
        blurb: mood.blurb,
        meta: mood.meta,
        energy: mood.energy,
      },
      tracks: result.tracks,
      sources: result.sources,
    });
  } catch (error) {
    console.error("[mood] failed", error);
    return jsonError("Couldn't build that vibe right now.", 502);
  }
}
