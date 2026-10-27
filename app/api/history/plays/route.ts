import type { NextRequest } from "next/server";

import { isSameOrigin, jsonError, jsonOk, zodMessage } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { listRecentPlays, recordPlay } from "@/lib/data";
import { rateLimit } from "@/lib/rate-limit";
import { playRecordSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return jsonError("Unauthorized", 401);

  const rawLimit = Number(request.nextUrl.searchParams.get("limit") ?? 12);
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(Math.trunc(rawLimit), 1), 40)
    : 12;

  const tracks = await listRecentPlays(user.id, limit);
  return jsonOk({ tracks });
}

/**
 * Fire-and-forget play logging from the player engine.
 * Also feeds Smart Shuffle's taste weighting.
 */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return jsonError("Forbidden", 403);

  const user = await getSessionUser();
  if (!user) return jsonError("Unauthorized", 401);

  const limit = rateLimit(`play:${user.id}`, 240, 60 * 1000);
  if (!limit.ok) return jsonOk({ ok: false, throttled: true });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Expected a JSON body", 400);
  }

  const parsed = playRecordSchema.safeParse(body);
  if (!parsed.success) return jsonError(zodMessage(parsed.error), 422);

  const data = parsed.data;

  await recordPlay(user.id, {
    trackId: data.trackId,
    provider: data.provider,
    providerId: data.trackId.split(":").slice(1).join(":") || data.trackId,
    title: data.title,
    artist: data.artist,
    artwork: data.artwork ?? null,
    contextLabel: data.contextLabel ?? null,
  });

  return jsonOk({ ok: true });
}
