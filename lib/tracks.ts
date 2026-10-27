/**
 * Shared track domain model.
 *
 * This module is imported by both the server (search aggregation, API routes)
 * and the client (player engine, UI). Keep it dependency-free.
 */

/**
 * Ordered by product priority: YouTube first. `interleave()` preserves this
 * order, so YouTube results lead the search list when a key is configured.
 */
export const TRACK_PROVIDERS = ["youtube", "audius", "archive"] as const;

export type TrackProvider = (typeof TRACK_PROVIDERS)[number];

export type TrackKind = "audio" | "video";

export interface Track {
  /** Stable, globally unique id: `${provider}:${providerId}`. */
  id: string;
  provider: TrackProvider;
  providerId: string;
  title: string;
  artist: string;
  album: string | null;
  artwork: string | null;
  /** Seconds. For preview-only sources this is the preview length. */
  duration: number | null;
  /** Direct, CORS-friendly audio URL. Null for iframe-backed sources. */
  streamUrl: string | null;
  externalUrl: string | null;
  kind: TrackKind;
  /** True when the source only exposes a short preview clip. */
  isPreview: boolean;
}

export interface TrackPlayInput {
  trackId: string;
  provider: TrackProvider;
  title: string;
  artist: string;
  artwork?: string | null;
  contextLabel?: string | null;
}

export const PROVIDER_LABELS: Record<TrackProvider, string> = {
  youtube: "YouTube",
  audius: "Audius",
  archive: "Archive.org",
};

export function makeTrackId(provider: TrackProvider, providerId: string): string {
  return `${provider}:${providerId}`;
}

export function isTrackProvider(value: unknown): value is TrackProvider {
  return (
    typeof value === "string" &&
    (TRACK_PROVIDERS as readonly string[]).includes(value)
  );
}

/** Defensive parser for track payloads arriving over the wire. */
export function parseTrack(value: unknown): Track | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;

  if (
    typeof raw.providerId !== "string" ||
    !isTrackProvider(raw.provider) ||
    typeof raw.title !== "string" ||
    typeof raw.artist !== "string"
  ) {
    return null;
  }

  const provider = raw.provider;
  const kind: TrackKind = raw.kind === "video" ? "video" : "audio";

  return {
    id:
      typeof raw.id === "string" && raw.id.length > 0
        ? raw.id
        : makeTrackId(provider, raw.providerId),
    provider,
    providerId: raw.providerId,
    title: raw.title.slice(0, 300),
    artist: raw.artist.slice(0, 300),
    album: typeof raw.album === "string" ? raw.album.slice(0, 300) : null,
    artwork: typeof raw.artwork === "string" ? raw.artwork : null,
    duration:
      typeof raw.duration === "number" && Number.isFinite(raw.duration)
        ? Math.max(0, Math.round(raw.duration))
        : null,
    streamUrl: typeof raw.streamUrl === "string" ? raw.streamUrl : null,
    externalUrl: typeof raw.externalUrl === "string" ? raw.externalUrl : null,
    kind,
    isPreview: raw.isPreview === true,
  };
}

/**
 * Normalises a title for cross-provider de-duplication: drops bracketed
 * qualifiers, "feat." tails and punctuation so the same recording returned by
 * two catalogues collapses into one row.
 */
export function normalizeTitle(input: string): string {
  return input
    .toLowerCase()
    .replace(/\([^)]*\)|\[[^\]]*\]/g, " ")
    .replace(/\b(feat|ft|featuring|prod|remaster(ed)?|official|video|audio|lyrics?|hd|hq)\b\.?/g, " ")
    .replace(/[^a-z0-9\u00c0-\u024f\u0600-\u06ff\u0400-\u04ff\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function dedupeKey(track: Track): string {
  const title = normalizeTitle(track.title) || track.title.toLowerCase();
  const artist = normalizeTitle(track.artist);
  return `${title}::${artist}`;
}

function titleOnlyKey(track: Track): string {
  return normalizeTitle(track.title) || track.title.toLowerCase();
}

/**
 * Removes duplicates across providers while preserving the first occurrence.
 * Provider order in the aggregated input is the quality preference order.
 */
export function dedupeTracks(tracks: Track[]): Track[] {
  const seenExact = new Set<string>();
  const seenTitle = new Set<string>();
  const out: Track[] = [];

  for (const track of tracks) {
    const exact = dedupeKey(track);
    const titleKey = titleOnlyKey(track);

    if (seenExact.has(exact)) continue;

    // Same title from a different provider with an unknown/blank artist is
    // almost always the same recording; keep the first (higher priority) one.
    if (titleKey.length > 6 && seenTitle.has(titleKey) && !track.artist) {
      continue;
    }

    seenExact.add(exact);
    if (titleKey.length > 6) seenTitle.add(titleKey);
    out.push(track);
  }

  return out;
}

/**
 * Round-robin interleave so a single provider can't dominate the top of the
 * results list. `groups` must be ordered by provider preference.
 */
export function interleave<T>(groups: T[][]): T[] {
  const out: T[] = [];
  const max = groups.reduce((acc, group) => Math.max(acc, group.length), 0);

  for (let i = 0; i < max; i += 1) {
    for (const group of groups) {
      if (i < group.length) out.push(group[i]);
    }
  }

  return out;
}

/** Deterministic Fisher-Yates shuffle (optionally seeded). */
export function shuffleArray<T>(input: T[], seed = Date.now()): T[] {
  const out = [...input];
  let state = seed % 2147483647;
  if (state <= 0) state += 2147483646;

  const random = () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };

  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }

  return out;
}

export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return "--:--";
  const total = Math.round(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function trackInitials(track: Pick<Track, "title">): string {
  const cleaned = track.title.trim();
  if (!cleaned) return "IB";
  return cleaned.slice(0, 2).toUpperCase();
}
