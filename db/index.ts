import "server-only";

import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import { drizzle as drizzleNode, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

/**
 * Database access layer.
 *
 * Two drivers, one API:
 *
 *  • Neon HTTP (`@neondatabase/serverless`) for `*.neon.tech` URLs. It skips
 *    the TCP handshake entirely, which is the right call on Vercel where every
 *    cold start would otherwise pay for a socket.
 *
 *  • node-postgres (`pg`) for anything else — a local Postgres for
 *    development, a self-hosted instance, Supabase, RDS. Same schema, same
 *    queries, no code changes.
 *
 * The intersection type keeps a single `Database` type for every query module;
 * both drivers expose identical Drizzle query builders.
 */

export type Database = NeonHttpDatabase<typeof schema> &
  NodePgDatabase<typeof schema>;

interface DbGlobal {
  __ironbeatDb?: Database;
  __ironbeatPool?: Pool;
}

const globalForDb = globalThis as unknown as DbGlobal;

function isNeonHttp(url: string): boolean {
  if (process.env.DATABASE_DRIVER === "neon-http") return true;
  if (process.env.DATABASE_DRIVER === "pg") return false;
  return /\.neon\.tech(\/|$|\?)/.test(url);
}

function createDatabase(): Database {
  const url = process.env.DATABASE_URL;

  if (!url) {
    throw new Error(
      "DATABASE_URL is not configured. Copy .env.example to .env.local and add your Neon connection string.",
    );
  }

  if (isNeonHttp(url)) {
    return drizzleNeon(neon(url), { schema }) as unknown as Database;
  }

  // Reuse the pool across hot reloads in development; without this every edit
  // leaks a handful of connections until Postgres refuses new ones.
  const pool =
    globalForDb.__ironbeatPool ??
    new Pool({
      connectionString: url,
      max: Number(process.env.DATABASE_POOL_MAX ?? 8),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      ssl: /sslmode=(require|verify)/.test(url)
        ? { rejectUnauthorized: false }
        : undefined,
    });

  pool.on("error", (error) => {
    console.error("[db] idle client error", error.message);
  });

  globalForDb.__ironbeatPool = pool;

  return drizzleNode(pool, { schema }) as unknown as Database;
}

/**
 * Lazily creates the client.
 *
 * Lazy initialisation matters: `next build` evaluates route modules without a
 * database available, so we must not throw at import time. The error surfaces
 * on first query, which is the correct failure mode.
 */
export function getDb(): Database {
  if (globalForDb.__ironbeatDb) return globalForDb.__ironbeatDb;

  const db = createDatabase();

  // Cache on globalThis so dev hot-reload doesn't build a new pool per request.
  globalForDb.__ironbeatDb = db;
  return db;
}

export { schema };
