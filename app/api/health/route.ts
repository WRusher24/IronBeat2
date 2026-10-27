import { sql } from "drizzle-orm";

import { getDb } from "@/db";
import { describeDbFailure } from "@/lib/db-errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EXPECTED_TABLES = [
  "users",
  "sessions",
  "playlists",
  "playlist_tracks",
  "favorite_tracks",
  "search_history",
  "track_plays",
] as const;

interface HealthPayload {
  ok: boolean;
  service: "ironbeat";
  database: "ready" | "uninitialised" | "unreachable" | "not_configured";
  tables?: { present: number; expected: number; missing: string[] };
  sources?: { audius: boolean; archive: boolean };
  latencyMs: number;
  message?: string;
  code?: string | null;
}

/**
 * Deployment diagnostics.
 *
 * GET /api/health
 *
 * 200 — database reachable and every table present
 * 503 — reachable but unmigrated, unreachable, or unconfigured
 *
 * Deliberately exposes no connection details: no host, user or password.
 */
export async function GET() {
  const startedAt = Date.now();

  const base = {
    service: "ironbeat" as const,
    sources: { audius: true, archive: true },
  };

  let rows: Array<{ table_name: string }>;

  try {
    const db = getDb();
    const result = (await db.execute(
      sql`select table_name from information_schema.tables where table_schema = 'public'`,
    )) as unknown as
      | { rows?: Array<{ table_name: string }> }
      | Array<{ table_name: string }>;

    rows = Array.isArray(result) ? result : (result.rows ?? []);
  } catch (error) {
    const failure = describeDbFailure(error);

    const database: HealthPayload["database"] = failure?.message.includes(
      "no DATABASE_URL",
    )
      ? "not_configured"
      : "unreachable";

    const payload: HealthPayload = {
      ...base,
      ok: false,
      database,
      latencyMs: Date.now() - startedAt,
      message:
        failure?.message ??
        "The database is unreachable. Check DATABASE_URL and your provider status.",
      code: failure?.code ?? null,
    };

    return Response.json(payload, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const present = new Set(rows.map((row) => row.table_name));
  const missing = EXPECTED_TABLES.filter((table) => !present.has(table));

  if (missing.length > 0) {
    const payload: HealthPayload = {
      ...base,
      ok: false,
      database: "uninitialised",
      tables: {
        present: EXPECTED_TABLES.length - missing.length,
        expected: EXPECTED_TABLES.length,
        missing,
      },
      latencyMs: Date.now() - startedAt,
      message:
        "The database is reachable but the schema is missing. Run `npm run db:migrate` against this database, then redeploy.",
    };

    return Response.json(payload, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const payload: HealthPayload = {
    ...base,
    ok: true,
    database: "ready",
    tables: {
      present: EXPECTED_TABLES.length,
      expected: EXPECTED_TABLES.length,
      missing: [],
    },
    latencyMs: Date.now() - startedAt,
  };

  return Response.json(payload, {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}
