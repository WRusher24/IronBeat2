import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";

import { getDb } from "@/db";
import { users } from "@/db/schema";
import { isSameOrigin, jsonError, jsonOk } from "@/lib/api";
import { destroySession, getSessionUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Permanently deletes the signed-in account.
 * Sessions, playlists, tracks, favourites and history cascade via FK.
 */
export async function DELETE(request: NextRequest) {
  if (!isSameOrigin(request)) return jsonError("Forbidden", 403);

  const user = await getSessionUser();
  if (!user) return jsonError("Unauthorized", 401);

  const db = getDb();
  await db.delete(users).where(eq(users.id, user.id));
  await destroySession();

  return jsonOk({ ok: true });
}
