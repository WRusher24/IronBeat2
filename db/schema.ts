import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * IronBeat database schema.
 *
 * Isolation model: every user-owned table carries `user_id`. Every query in
 * `lib/queries/*` filters on the authenticated user id, and composite indexes
 * are shaped around `(user_id, ...)` so the planner never has to scan across
 * tenants.
 */

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    displayName: text("display_name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("users_email_uq").on(table.email)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** SHA-256 of the opaque cookie token. The raw token never hits the DB. */
    tokenHash: text("token_hash").notNull(),
    userAgent: text("user_agent"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("sessions_token_hash_uq").on(table.tokenHash),
    index("sessions_user_idx").on(table.userId),
    index("sessions_expires_idx").on(table.expiresAt),
  ],
);

export const playlists = pgTable(
  "playlists",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    /** One of: amber | ember | moss | ocean | violet | sand */
    accent: text("accent").notNull().default("amber"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("playlists_user_idx").on(table.userId, table.updatedAt),
  ],
);

/**
 * Denormalised track snapshot. We intentionally store the full playable
 * payload (stream URL, artwork, provider) so a playlist keeps working even if
 * an upstream search index changes shape.
 */
export const playlistTracks = pgTable(
  "playlist_tracks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    playlistId: uuid("playlist_id")
      .notNull()
      .references(() => playlists.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    trackId: text("track_id").notNull(),
    provider: text("provider").notNull(),
    providerId: text("provider_id").notNull(),
    title: text("title").notNull(),
    artist: text("artist").notNull(),
    album: text("album"),
    artwork: text("artwork"),
    duration: integer("duration"),
    streamUrl: text("stream_url"),
    externalUrl: text("external_url"),
    /** Playback kind. Currently always "audio"; kept for forward compatibility. */
    kind: text("kind").notNull().default("audio"),
    isPreview: boolean("is_preview").notNull().default(false),
    position: integer("position").notNull().default(0),
    addedAt: timestamp("added_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("playlist_tracks_playlist_idx").on(table.playlistId, table.position),
    index("playlist_tracks_user_idx").on(table.userId),
    uniqueIndex("playlist_tracks_unique").on(table.playlistId, table.trackId),
  ],
);

export const favoriteTracks = pgTable(
  "favorite_tracks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    trackId: text("track_id").notNull(),
    provider: text("provider").notNull(),
    providerId: text("provider_id").notNull(),
    title: text("title").notNull(),
    artist: text("artist").notNull(),
    album: text("album"),
    artwork: text("artwork"),
    duration: integer("duration"),
    streamUrl: text("stream_url"),
    externalUrl: text("external_url"),
    kind: text("kind").notNull().default("audio"),
    isPreview: boolean("is_preview").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("favorites_user_track_uq").on(table.userId, table.trackId),
    index("favorites_user_idx").on(table.userId, table.createdAt),
  ],
);

export const searchHistory = pgTable(
  "search_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Original casing, shown on the chip. */
    query: text("query").notNull(),
    /** Lowercased + whitespace-collapsed, used for de-duplication. */
    normalized: text("normalized").notNull(),
    resultCount: integer("result_count").notNull().default(0),
    hitCount: integer("hit_count").notNull().default(1),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("search_history_user_query_uq").on(
      table.userId,
      table.normalized,
    ),
    index("search_history_recent_idx").on(table.userId, table.lastUsedAt),
  ],
);

/**
 * Play log. Powers "Recently played" plus the Smart Shuffle weighting
 * (which providers / artists / queries a lifter actually reaches for).
 */
export const trackPlays = pgTable(
  "track_plays",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    trackId: text("track_id").notNull(),
    provider: text("provider").notNull(),
    providerId: text("provider_id").notNull(),
    title: text("title").notNull(),
    artist: text("artist").notNull(),
    album: text("album"),
    artwork: text("artwork"),
    duration: integer("duration"),
    streamUrl: text("stream_url"),
    externalUrl: text("external_url"),
    kind: text("kind").notNull().default("audio"),
    isPreview: boolean("is_preview").notNull().default(false),
    /** Free-form context label: mood name, playlist name, or search query. */
    contextLabel: text("context_label"),
    playedAt: timestamp("played_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("track_plays_user_idx").on(table.userId, table.playedAt),
    index("track_plays_track_idx").on(table.userId, table.trackId),
  ],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Playlist = typeof playlists.$inferSelect;
export type PlaylistTrack = typeof playlistTracks.$inferSelect;
export type FavoriteTrack = typeof favoriteTracks.$inferSelect;
export type SearchHistoryRow = typeof searchHistory.$inferSelect;
export type TrackPlay = typeof trackPlays.$inferSelect;
