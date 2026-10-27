import "server-only";

import { and, eq, gt, lt } from "drizzle-orm";

import { getDb } from "@/db";
import { searchCache } from "@/db/schema";

/**
 * Persistent cache for quota-metered upstream queries.
 *
 * YouTube charges 100 units per `search.list` call against a 10,000/day
 * default. Mood cards expand into several seed queries, so an uncached deck
 * costs thousands of units in a single session. Caching in Postgres rather
 * than only in memory matters because serverless instances are short-lived:
 * a per-instance Map is empty on every cold start.
 *
 * Two TTLs:
 *   • fresh — served normally (default 24 h)
 *   • stale — served only when the upstream call fails, e.g. quota exhausted,
 *     so a previously-searched term keeps working past the daily reset
 */

export interface CachedValue<T> {
  value: T;
  stale: boolean;
}

const STALE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/** Reads a cache entry. Never throws — a broken cache must not break search. */
export async function readSearchCache<T>(
  key: string,
  options: { allowStale?: boolean } = {},
): Promise<CachedValue<T> | null> {
  try {
    const db = getDb();
    const rows = await db
      .select({
        payload: searchCache.payload,
        createdAt: searchCache.createdAt,
        expiresAt: searchCache.expiresAt,
      })
      .from(searchCache)
      .where(
        options.allowStale
          ? and(
              eq(searchCache.key, key),
              gt(searchCache.createdAt, new Date(Date.now() - STALE_WINDOW_MS)),
            )
          : and(eq(searchCache.key, key), gt(searchCache.expiresAt, new Date())),
      )
      .limit(1);

    const row = rows[0];
    if (!row) return null;

    return {
      value: row.payload as T,
      stale: row.expiresAt.getTime() <= Date.now(),
    };
  } catch (error) {
    console.warn("[cache] read failed", error instanceof Error ? error.message : error);
    return null;
  }
}

/** Upserts a cache entry. Never throws. */
export async function writeSearchCache<T>(
  key: string,
  value: T,
  ttlMs: number,
): Promise<void> {
  try {
    const db = getDb();
    const now = new Date();

    await db
      .insert(searchCache)
      .values({
        key,
        payload: value as unknown,
        createdAt: now,
        expiresAt: new Date(now.getTime() + ttlMs),
      })
      .onConflictDoUpdate({
        target: searchCache.key,
        set: {
          payload: value as unknown,
          createdAt: now,
          expiresAt: new Date(now.getTime() + ttlMs),
        },
      });

    // Opportunistic cleanup so the table cannot grow without bound.
    if (Math.random() < 0.05) {
      await db
        .delete(searchCache)
        .where(lt(searchCache.expiresAt, new Date(Date.now() - STALE_WINDOW_MS)))
        .catch(() => undefined);
    }
  } catch (error) {
    console.warn("[cache] write failed", error instanceof Error ? error.message : error);
  }
}

/** Normalises a query so "Phonk " and "phonk" share one cache entry. */
export function cacheKeyFor(namespace: string, query: string, limit: number): string {
  const normalized = query.trim().toLowerCase().replace(/\s+/g, " ");
  return `${namespace}:${normalized}:${limit}`;
}
