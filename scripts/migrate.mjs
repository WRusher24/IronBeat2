#!/usr/bin/env node
/**
 * Applies Drizzle migrations using the official migrator.
 *
 * Runs in three places:
 *   • locally        — `npm run db:migrate`
 *   • Vercel builds  — via the `vercel-build` script, so a deploy can never
 *                      ship against an empty database again
 *   • CI             — against a preview branch
 *
 * Deliberately does not import `db/index.ts`: that module is marked
 * `server-only` and would throw outside a React Server Component context.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

const { Pool } = pg;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationsFolder = path.join(root, "drizzle");

const EXPECTED_TABLES = [
  "users",
  "sessions",
  "playlists",
  "playlist_tracks",
  "favorite_tracks",
  "search_history",
  "track_plays",
];

/** Vercel env values are sometimes pasted with the surrounding quotes. */
function normalizeUrl(raw) {
  return raw.trim().replace(/^['"]+/, "").replace(/['"]+$/, "");
}

async function loadEnvFile() {
  if (process.env.DATABASE_URL) return;

  try {
    const { config } = await import("dotenv");
    config({ path: [path.join(root, ".env.local"), path.join(root, ".env")] });
  } catch {
    // dotenv is a devDependency; production builds rely on real env vars.
  }
}

async function main() {
  await loadEnvFile();

  const raw = process.env.DATABASE_URL;
  if (!raw || raw.trim().length === 0) {
    console.error("✖ DATABASE_URL is not set.");
    console.error("  Local: add it to .env.local. Vercel: Project → Settings → Environment Variables.");
    process.exit(1);
  }

  const connectionString = normalizeUrl(raw);
  const isNeon = /\.neon\.tech/.test(connectionString);

  const pool = new Pool({
    connectionString,
    max: 2,
    connectionTimeoutMillis: 15_000,
    ssl: /sslmode=(require|verify)/.test(connectionString)
      ? { rejectUnauthorized: false }
      : undefined,
  });

  try {
    await pool.query("select 1");
  } catch (error) {
    console.error("✖ Could not connect to the database.");
    console.error(`  ${error instanceof Error ? error.message : String(error)}`);
    console.error("  Check that DATABASE_URL is correct and the database is running.");
    await pool.end().catch(() => undefined);
    process.exit(1);
  }

  const host = (() => {
    try {
      return new URL(connectionString).host;
    } catch {
      return "unknown host";
    }
  })();

  console.log(`→ Migrating ${host}${isNeon ? " (Neon)" : ""}`);

  try {
    await migrate(drizzle(pool), { migrationsFolder });
  } catch (error) {
    console.error("✖ Migration failed.");
    console.error(`  ${error instanceof Error ? error.message : String(error)}`);
    console.error(
      "  If the tables already exist from an older schema, point DATABASE_URL at a fresh database or run `npm run db:push`.",
    );
    await pool.end().catch(() => undefined);
    process.exit(1);
  }

  const result = await pool.query(
    "select table_name from information_schema.tables where table_schema = 'public'",
  );
  const present = new Set(result.rows.map((row) => row.table_name));
  const missing = EXPECTED_TABLES.filter((table) => !present.has(table));

  await pool.end().catch(() => undefined);

  if (missing.length > 0) {
    console.error(`✖ Migration finished but these tables are missing: ${missing.join(", ")}`);
    process.exit(1);
  }

  console.log(`✓ Migrations applied — ${EXPECTED_TABLES.length}/${EXPECTED_TABLES.length} tables ready`);
}

main().catch((error) => {
  console.error("✖ Unexpected migration error:", error);
  process.exit(1);
});
