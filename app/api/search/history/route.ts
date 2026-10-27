import type { NextRequest } from "next/server";

import { isSameOrigin, jsonError, jsonOk } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { clearSearchHistory, listRecentSearches } from "@/lib/data";

export const dynamic = "force-dynamic";

/** Recent successful searches — powers the quick-launch chip row. */
export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return jsonError("Unauthorized", 401);

  const rawLimit = Number(request.nextUrl.searchParams.get("limit") ?? 8);
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(Math.trunc(rawLimit), 1), 20)
    : 8;

  const searches = await listRecentSearches(user.id, limit);

  return jsonOk({
    searches: searches.map((search) => ({
      query: search.query,
      hitCount: search.hitCount,
      lastUsedAt: search.lastUsedAt,
    })),
  });
}

/** Clears the chip row. Pass ?q=... to remove a single chip. */
export async function DELETE(request: NextRequest) {
  if (!isSameOrigin(request)) return jsonError("Forbidden", 403);

  const user = await getSessionUser();
  if (!user) return jsonError("Unauthorized", 401);

  const target = request.nextUrl.searchParams.get("q") ?? undefined;
  await clearSearchHistory(user.id, target ?? undefined);

  return jsonOk({ ok: true });
}
