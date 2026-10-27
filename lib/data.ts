import "server-only";

import { and, desc, eq, inArray, sql } from "drizzle-orm";

import { getDb } from "@/db";
import {
  favoriteTracks,
  playlists,
  playlistTracks,
  searchHistory,
  trackPlays,
} from "@/db/schema";
import type { Track, TrackPlayInput, TrackProvider } from "@/lib/tracks";
import { TRACK_PROVIDERS } from "@/lib/tracks";

/**
 * Every function in this module takes `userId` as its first argument and
 * includes it in the WHERE clause. There is no "get by id only" helper —
 * that's the invariant that keeps vaults isolated.
 */

/**
 * Sources IronBeat currently plays. Rows saved by sources that have since been
 * removed (preview-only catalogues, iframe-backed video) stay in the database
 * but are filtered out of every read, so a vault never surfaces a track that
 * can no longer play in full.
 */
const SUPPORTED_PROVIDERS = TRACK_PROVIDERS as unknown as string[];

export interface PlaylistSummary {
  id: string;
  name: string;
  description: string | null;
  accent: string;
  trackCount: number;
  updatedAt: Date;
}

export interface PlaylistDetail extends PlaylistSummary {
  tracks: Track[];
}

interface TrackRowLike {
  trackId: string;
  provider: string;
  providerId: string;
  title: string;
  artist: string;
  album: string | null;
  artwork: string | null;
  duration: number | null;
  streamUrl: string | null;
  externalUrl: string | null;
  kind: string;
  isPreview: boolean;
}

export function rowToTrack(row: TrackRowLike): Track {
  return {
    id: row.trackId,
    provider: row.provider as TrackProvider,
    providerId: row.providerId,
    title: row.title,
    artist: row.artist,
    album: row.album,
    artwork: row.artwork,
    duration: row.duration,
    streamUrl: row.streamUrl,
    externalUrl: row.externalUrl,
    kind: row.kind === "video" ? "video" : "audio",
    isPreview: row.isPreview,
  };
}

// ---------------------------------------------------------------------------
// Playlists
// ---------------------------------------------------------------------------

export async function listPlaylists(userId: string): Promise<PlaylistSummary[]> {
  const db = getDb();

  const rows = await db
    .select({
      id: playlists.id,
      name: playlists.name,
      description: playlists.description,
      accent: playlists.accent,
      updatedAt: playlists.updatedAt,
      trackCount: sql<number>`count(${playlistTracks.id})::int`,
    })
    .from(playlists)
    .leftJoin(
      playlistTracks,
      and(
        eq(playlistTracks.playlistId, playlists.id),
        inArray(playlistTracks.provider, SUPPORTED_PROVIDERS),
      ),
    )
    .where(eq(playlists.userId, userId))
    .groupBy(playlists.id)
    .orderBy(desc(playlists.updatedAt));

  return rows.map((row) => ({
    ...row,
    trackCount: Number(row.trackCount ?? 0),
  }));
}

export async function getPlaylist(
  userId: string,
  playlistId: string,
): Promise<PlaylistDetail | null> {
  const db = getDb();

  const playlistRows = await db
    .select()
    .from(playlists)
    .where(and(eq(playlists.id, playlistId), eq(playlists.userId, userId)))
    .limit(1);

  const playlist = playlistRows[0];
  if (!playlist) return null;

  const trackRows = await db
    .select()
    .from(playlistTracks)
    .where(
      and(
        eq(playlistTracks.playlistId, playlistId),
        eq(playlistTracks.userId, userId),
        inArray(playlistTracks.provider, SUPPORTED_PROVIDERS),
      ),
    )
    .orderBy(playlistTracks.position, playlistTracks.addedAt);

  return {
    id: playlist.id,
    name: playlist.name,
    description: playlist.description,
    accent: playlist.accent,
    updatedAt: playlist.updatedAt,
    trackCount: trackRows.length,
    tracks: trackRows.map(rowToTrack),
  };
}

export async function createPlaylist(
  userId: string,
  input: { name: string; description?: string | null; accent?: string },
): Promise<PlaylistSummary> {
  const db = getDb();

  const inserted = await db
    .insert(playlists)
    .values({
      userId,
      name: input.name,
      description: input.description ?? null,
      accent: input.accent ?? "amber",
    })
    .returning();

  const playlist = inserted[0];

  return {
    id: playlist.id,
    name: playlist.name,
    description: playlist.description,
    accent: playlist.accent,
    trackCount: 0,
    updatedAt: playlist.updatedAt,
  };
}

export async function updatePlaylist(
  userId: string,
  playlistId: string,
  input: { name?: string; description?: string | null; accent?: string },
): Promise<boolean> {
  const db = getDb();

  const updated = await db
    .update(playlists)
    .set({ ...input, updatedAt: new Date() })
    .where(and(eq(playlists.id, playlistId), eq(playlists.userId, userId)))
    .returning({ id: playlists.id });

  return updated.length > 0;
}

export async function deletePlaylist(
  userId: string,
  playlistId: string,
): Promise<boolean> {
  const db = getDb();

  const deleted = await db
    .delete(playlists)
    .where(and(eq(playlists.id, playlistId), eq(playlists.userId, userId)))
    .returning({ id: playlists.id });

  return deleted.length > 0;
}

export async function addTrackToPlaylist(
  userId: string,
  playlistId: string,
  track: Omit<TrackRowLike, "trackId"> & { id: string },
): Promise<"added" | "duplicate" | "not_found"> {
  const db = getDb();

  const owned = await db
    .select({ id: playlists.id })
    .from(playlists)
    .where(and(eq(playlists.id, playlistId), eq(playlists.userId, userId)))
    .limit(1);

  if (owned.length === 0) return "not_found";

  const positionRows = await db
    .select({
      maxPosition: sql<number>`coalesce(max(${playlistTracks.position}), -1)::int`,
    })
    .from(playlistTracks)
    .where(eq(playlistTracks.playlistId, playlistId));

  const nextPosition = Number(positionRows[0]?.maxPosition ?? -1) + 1;

  const inserted = await db
    .insert(playlistTracks)
    .values({
      playlistId,
      userId,
      trackId: track.id,
      provider: track.provider,
      providerId: track.providerId,
      title: track.title,
      artist: track.artist,
      album: track.album,
      artwork: track.artwork,
      duration: track.duration,
      streamUrl: track.streamUrl,
      externalUrl: track.externalUrl,
      kind: track.kind,
      isPreview: track.isPreview,
      position: nextPosition,
    })
    .onConflictDoNothing({
      target: [playlistTracks.playlistId, playlistTracks.trackId],
    })
    .returning({ id: playlistTracks.id });

  if (inserted.length === 0) return "duplicate";

  await db
    .update(playlists)
    .set({ updatedAt: new Date() })
    .where(eq(playlists.id, playlistId));

  return "added";
}

export async function removeTrackFromPlaylist(
  userId: string,
  playlistId: string,
  trackId: string,
): Promise<boolean> {
  const db = getDb();

  const deleted = await db
    .delete(playlistTracks)
    .where(
      and(
        eq(playlistTracks.playlistId, playlistId),
        eq(playlistTracks.userId, userId),
        eq(playlistTracks.trackId, trackId),
      ),
    )
    .returning({ id: playlistTracks.id });

  return deleted.length > 0;
}

/** Swaps a track with its neighbour. Positions are re-normalised on write. */
export async function moveTrackInPlaylist(
  userId: string,
  playlistId: string,
  trackId: string,
  direction: "up" | "down",
): Promise<boolean> {
  const db = getDb();

  const rows = await db
    .select({ id: playlistTracks.id, trackId: playlistTracks.trackId })
    .from(playlistTracks)
    .where(
      and(
        eq(playlistTracks.playlistId, playlistId),
        eq(playlistTracks.userId, userId),
        inArray(playlistTracks.provider, SUPPORTED_PROVIDERS),
      ),
    )
    .orderBy(playlistTracks.position, playlistTracks.addedAt);

  const index = rows.findIndex((row) => row.trackId === trackId);
  if (index === -1) return false;

  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= rows.length) return false;

  const reordered = [...rows];
  [reordered[index], reordered[targetIndex]] = [
    reordered[targetIndex],
    reordered[index],
  ];

  // Two sequential updates rather than a transaction: `db.batch` is a
  // Neon-HTTP-only API, and this layer must run on both drivers.
  await db
    .update(playlistTracks)
    .set({ position: index })
    .where(eq(playlistTracks.id, reordered[index].id));

  await db
    .update(playlistTracks)
    .set({ position: targetIndex })
    .where(eq(playlistTracks.id, reordered[targetIndex].id));

  return true;
}

// ---------------------------------------------------------------------------
// Favourites
// ---------------------------------------------------------------------------

export async function listFavorites(userId: string): Promise<Track[]> {
  const db = getDb();

  const rows = await db
    .select()
    .from(favoriteTracks)
    .where(
      and(
        eq(favoriteTracks.userId, userId),
        inArray(favoriteTracks.provider, SUPPORTED_PROVIDERS),
      ),
    )
    .orderBy(desc(favoriteTracks.createdAt));

  return rows.map(rowToTrack);
}

export async function getFavoriteIds(userId: string): Promise<string[]> {
  const db = getDb();

  const rows = await db
    .select({ trackId: favoriteTracks.trackId })
    .from(favoriteTracks)
    .where(
      and(
        eq(favoriteTracks.userId, userId),
        inArray(favoriteTracks.provider, SUPPORTED_PROVIDERS),
      ),
    );

  return rows.map((row) => row.trackId);
}

export async function toggleFavorite(
  userId: string,
  track: Omit<TrackRowLike, "trackId"> & { id: string },
): Promise<{ favorited: boolean }> {
  const db = getDb();

  const existing = await db
    .select({ id: favoriteTracks.id })
    .from(favoriteTracks)
    .where(
      and(eq(favoriteTracks.userId, userId), eq(favoriteTracks.trackId, track.id)),
    )
    .limit(1);

  if (existing.length > 0) {
    await db
      .delete(favoriteTracks)
      .where(
        and(
          eq(favoriteTracks.userId, userId),
          eq(favoriteTracks.trackId, track.id),
        ),
      );
    return { favorited: false };
  }

  await db
    .insert(favoriteTracks)
    .values({
      userId,
      trackId: track.id,
      provider: track.provider,
      providerId: track.providerId,
      title: track.title,
      artist: track.artist,
      album: track.album,
      artwork: track.artwork,
      duration: track.duration,
      streamUrl: track.streamUrl,
      externalUrl: track.externalUrl,
      kind: track.kind,
      isPreview: track.isPreview,
    })
    .onConflictDoNothing({
      target: [favoriteTracks.userId, favoriteTracks.trackId],
    });

  return { favorited: true };
}

// ---------------------------------------------------------------------------
// Search history
// ---------------------------------------------------------------------------

export interface RecentSearch {
  query: string;
  hitCount: number;
  lastUsedAt: Date;
}

export async function listRecentSearches(
  userId: string,
  limit = 8,
): Promise<RecentSearch[]> {
  const db = getDb();

  const rows = await db
    .select({
      query: searchHistory.query,
      hitCount: searchHistory.hitCount,
      lastUsedAt: searchHistory.lastUsedAt,
    })
    .from(searchHistory)
    .where(eq(searchHistory.userId, userId))
    .orderBy(desc(searchHistory.lastUsedAt))
    .limit(limit);

  return rows;
}

export async function recordSearch(
  userId: string,
  query: string,
  resultCount: number,
): Promise<void> {
  const normalized = query.trim().toLowerCase().replace(/\s+/g, " ");
  if (normalized.length < 2) return;

  const db = getDb();

  await db
    .insert(searchHistory)
    .values({
      userId,
      query: query.trim().slice(0, 120),
      normalized: normalized.slice(0, 120),
      resultCount,
      hitCount: 1,
      lastUsedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [searchHistory.userId, searchHistory.normalized],
      set: {
        query: query.trim().slice(0, 120),
        resultCount,
        lastUsedAt: new Date(),
        hitCount: sql`${searchHistory.hitCount} + 1`,
      },
    });
}

export async function clearSearchHistory(
  userId: string,
  normalizedQuery?: string,
): Promise<void> {
  const db = getDb();

  if (normalizedQuery) {
    await db
      .delete(searchHistory)
      .where(
        and(
          eq(searchHistory.userId, userId),
          eq(searchHistory.normalized, normalizedQuery.toLowerCase().trim()),
        ),
      );
    return;
  }

  await db.delete(searchHistory).where(eq(searchHistory.userId, userId));
}

// ---------------------------------------------------------------------------
// Play log
// ---------------------------------------------------------------------------

export async function recordPlay(
  userId: string,
  input: TrackPlayInput & {
    providerId: string;
    album?: string | null;
    duration?: number | null;
    streamUrl?: string | null;
    externalUrl?: string | null;
    kind?: string;
    isPreview?: boolean;
  },
): Promise<void> {
  const db = getDb();

  await db.insert(trackPlays).values({
    userId,
    trackId: input.trackId.slice(0, 400),
    provider: input.provider,
    providerId: input.providerId.slice(0, 400),
    title: input.title.slice(0, 300),
    artist: input.artist.slice(0, 300),
    album: input.album ?? null,
    artwork: input.artwork ?? null,
    duration: input.duration ?? null,
    streamUrl: input.streamUrl ?? null,
    externalUrl: input.externalUrl ?? null,
    kind: input.kind ?? "audio",
    isPreview: input.isPreview ?? false,
    contextLabel: input.contextLabel?.slice(0, 120) ?? null,
  });
}

export async function listRecentPlays(
  userId: string,
  limit = 12,
): Promise<Track[]> {
  const db = getDb();

  const rows = await db
    .select({
      trackId: trackPlays.trackId,
      provider: trackPlays.provider,
      providerId: trackPlays.providerId,
      title: trackPlays.title,
      artist: trackPlays.artist,
      album: trackPlays.album,
      artwork: trackPlays.artwork,
      duration: trackPlays.duration,
      streamUrl: trackPlays.streamUrl,
      externalUrl: trackPlays.externalUrl,
      kind: trackPlays.kind,
      isPreview: trackPlays.isPreview,
      lastPlayed: sql<Date>`max(${trackPlays.playedAt})`,
    })
    .from(trackPlays)
    .where(
      and(
        eq(trackPlays.userId, userId),
        inArray(trackPlays.provider, SUPPORTED_PROVIDERS),
      ),
    )
    .groupBy(
      trackPlays.trackId,
      trackPlays.provider,
      trackPlays.providerId,
      trackPlays.title,
      trackPlays.artist,
      trackPlays.album,
      trackPlays.artwork,
      trackPlays.duration,
      trackPlays.streamUrl,
      trackPlays.externalUrl,
      trackPlays.kind,
      trackPlays.isPreview,
    )
    .orderBy(sql`max(${trackPlays.playedAt}) desc`)
    .limit(limit);

  return rows.map(rowToTrack);
}

export async function topSearchSeeds(userId: string, limit = 6): Promise<string[]> {
  const db = getDb();

  const rows = await db
    .select({
      query: searchHistory.query,
      hitCount: searchHistory.hitCount,
      lastUsedAt: searchHistory.lastUsedAt,
    })
    .from(searchHistory)
    .where(eq(searchHistory.userId, userId))
    .orderBy(desc(searchHistory.hitCount), desc(searchHistory.lastUsedAt))
    .limit(limit);

  return rows.map((row) => row.query);
}

export async function topArtists(userId: string, limit = 4): Promise<string[]> {
  const db = getDb();

  const rows = await db
    .select({
      artist: trackPlays.artist,
      plays: sql<number>`count(*)::int`,
    })
    .from(trackPlays)
    .where(
      and(
        eq(trackPlays.userId, userId),
        inArray(trackPlays.provider, SUPPORTED_PROVIDERS),
      ),
    )
    .groupBy(trackPlays.artist)
    .orderBy(sql`count(*) desc`)
    .limit(limit);

  return rows.map((row) => row.artist).filter(Boolean);
}

export async function getLibraryStats(userId: string): Promise<{
  playlistCount: number;
  favoriteCount: number;
  playCount: number;
}> {
  const db = getDb();

  const [playlistRow, favoriteRow, playRow] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(playlists)
      .where(eq(playlists.userId, userId)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(favoriteTracks)
      .where(
        and(
          eq(favoriteTracks.userId, userId),
          inArray(favoriteTracks.provider, SUPPORTED_PROVIDERS),
        ),
      ),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(trackPlays)
      .where(
        and(
          eq(trackPlays.userId, userId),
          inArray(trackPlays.provider, SUPPORTED_PROVIDERS),
        ),
      ),
  ]);

  return {
    playlistCount: Number(playlistRow[0]?.count ?? 0),
    favoriteCount: Number(favoriteRow[0]?.count ?? 0),
    playCount: Number(playRow[0]?.count ?? 0),
  };
}
