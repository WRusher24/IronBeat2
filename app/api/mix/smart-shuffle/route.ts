import { jsonError, jsonOk } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { searchSeeds } from "@/lib/audio/search";
import { topArtists, topSearchSeeds } from "@/lib/data";
import { STARTER_SEEDS } from "@/lib/moods";
import { rateLimit } from "@/lib/rate-limit";
import { shuffleArray } from "@/lib/tracks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Smart Shuffle — builds a one-off mix from the lifter's own behaviour.
 *
 * Signals, in order of weight:
 *   1. Most-repeated search queries  (what they deliberately reach for)
 *   2. Most-played artists           (what actually gets listened to)
 *   3. Starter seeds                 (cold start / new account)
 *
 * The result is shuffled so two consecutive shuffles never feel identical.
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return jsonError("Unauthorized", 401);

  const limit = rateLimit(`smart-shuffle:${user.id}`, 30, 60 * 1000);
  if (!limit.ok) return jsonError("Give the mix a second to reset.", 429);

  const [searches, artists] = await Promise.all([
    topSearchSeeds(user.id, 5),
    topArtists(user.id, 3),
  ]);

  const basis: string[] = [];
  const push = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (basis.some((item) => item.toLowerCase() === trimmed.toLowerCase())) return;
    basis.push(trimmed);
  };

  searches.forEach(push);
  artists.forEach(push);

  if (basis.length < 3) {
    for (const seed of STARTER_SEEDS) {
      if (basis.length >= 3) break;
      push(seed);
    }
  }

  const seeds = basis.slice(0, 6);
  const isColdStart = searches.length === 0 && artists.length === 0;

  try {
    const result = await searchSeeds(seeds, { perSeed: 10, total: 40 });
    const shuffled = shuffleArray(result.tracks);

    return jsonOk({
      tracks: shuffled,
      basis: seeds,
      coldStart: isColdStart,
      sources: result.sources,
    });
  } catch (error) {
    console.error("[smart-shuffle] failed", error);
    return jsonError("Couldn't build your mix right now.", 502);
  }
}
