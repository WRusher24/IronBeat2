import type { Track } from "@/lib/tracks";
import { makeTrackId } from "@/lib/tracks";

import { cacheKeyFor, readSearchCache, writeSearchCache } from "../cache-db";
import { cached } from "../cache";

/**
 * YouTube Data API v3 — optional source.
 *
 * Enabled only when `YOUTUBE_API_KEY` is configured. Results are played
 * through the official IFrame Player (see `lib/audio/youtube.ts`), which keeps
 * playback inside YouTube's terms rather than extracting streams.
 *
 * Docs: https://developers.google.com/youtube/v3/docs/search/list
 */

interface YouTubeSearchItem {
  id?: { videoId?: string };
  snippet?: {
    title?: string;
    channelTitle?: string;
    thumbnails?: {
      maxres?: { url?: string };
      high?: { url?: string };
      medium?: { url?: string };
    };
  };
}

interface YouTubeSearchResponse {
  items?: YouTubeSearchItem[];
  error?: { message?: string; code?: number };
}

interface YouTubeVideoItem {
  id?: string;
  contentDetails?: { duration?: string };
}

interface YouTubeVideoResponse {
  items?: YouTubeVideoItem[];
}

export function isYouTubeConfigured(): boolean {
  return Boolean(process.env.YOUTUBE_API_KEY);
}

/** Parses an ISO-8601 duration (PT1H2M3S) into seconds. */
function parseIsoDuration(value: string | undefined): number | null {
  if (!value) return null;
  const match = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(value);
  if (!match) return null;

  const days = Number(match[1] ?? 0);
  const hours = Number(match[2] ?? 0);
  const minutes = Number(match[3] ?? 0);
  const seconds = Number(match[4] ?? 0);

  const total = days * 86400 + hours * 3600 + minutes * 60 + seconds;
  return total > 0 ? total : null;
}

/**
 * Turns Google's error envelope into a fixable instruction.
 *
 * Every YouTube failure looks like a bare 403 in the logs, but the body says
 * exactly which of four things is wrong — and they need four different fixes.
 */
async function describeYouTubeError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as {
      error?: {
        message?: string;
        errors?: Array<{ reason?: string }>;
      };
    };

    const reason = body.error?.errors?.[0]?.reason;

    switch (reason) {
      case "quotaExceeded":
        return "YouTube daily quota exhausted";
      case "keyInvalid":
        return "YouTube API key is invalid";
      case "keyExpired":
        return "YouTube API key has expired";
      case "ipRefererBlocked":
      case "refererRestriction":
        return "YouTube key is restricted by referrer — set Application restrictions to None for server use";
      case "accessNotConfigured":
        return "YouTube Data API v3 is not enabled for this key's project";
      case "dailyLimitExceeded":
        return "YouTube project daily limit exceeded";
      default:
        return (
          body.error?.message?.slice(0, 140) ??
          `YouTube search responded ${response.status}`
        );
    }
  } catch {
    return `YouTube search responded ${response.status}`;
  }
}

/** Cached results stay fresh for a day; an exhausted quota may serve them for a week. */
const FRESH_TTL_MS = 24 * 60 * 60 * 1000;
const EMPTY_TTL_MS = 60 * 60 * 1000;

async function fetchYouTubeTracks(
  apiKey: string,
  query: string,
  limit: number,
  signal: AbortSignal,
): Promise<Track[]> {
  const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
  searchUrl.searchParams.set("part", "snippet");
  searchUrl.searchParams.set("type", "video");
  searchUrl.searchParams.set("maxResults", String(Math.min(limit, 25)));
  searchUrl.searchParams.set("q", query);
  searchUrl.searchParams.set("videoEmbeddable", "true");
  searchUrl.searchParams.set("safeSearch", "moderate");
  searchUrl.searchParams.set("key", apiKey);

  const searchResponse = await fetch(searchUrl, {
    signal: AbortSignal.any([signal, AbortSignal.timeout(6000)]),
    headers: { Accept: "application/json" },
    next: { revalidate: 600 },
  });

  if (!searchResponse.ok) {
    throw new Error(await describeYouTubeError(searchResponse));
  }

  const searchData = (await searchResponse.json()) as YouTubeSearchResponse;
  if (searchData.error) {
    throw new Error(searchData.error.message ?? "YouTube search failed");
  }

  const items = (searchData.items ?? []).filter((item) => item.id?.videoId);
  if (items.length === 0) return [];

  // One extra quota unit buys real durations for the whole batch.
  const ids = items.map((item) => item.id!.videoId!).join(",");
  const durations = new Map<string, number>();

  try {
    const videoUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
    videoUrl.searchParams.set("part", "contentDetails");
    videoUrl.searchParams.set("id", ids);
    videoUrl.searchParams.set("key", apiKey);

    const videoResponse = await fetch(videoUrl, {
      signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]),
      headers: { Accept: "application/json" },
      next: { revalidate: 3600 },
    });

    if (videoResponse.ok) {
      const videoData = (await videoResponse.json()) as YouTubeVideoResponse;
      for (const video of videoData.items ?? []) {
        const seconds = parseIsoDuration(video.contentDetails?.duration);
        if (video.id && seconds) durations.set(video.id, seconds);
      }
    }
  } catch {
    // Durations are cosmetic; a failure here must not fail the search.
  }

  const tracks: Track[] = [];

  for (const item of items) {
    const videoId = item.id!.videoId!;
    const snippet = item.snippet ?? {};
    const thumbnail =
      snippet.thumbnails?.maxres?.url ??
      snippet.thumbnails?.high?.url ??
      snippet.thumbnails?.medium?.url ??
      `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

    tracks.push({
      id: makeTrackId("youtube", videoId),
      provider: "youtube",
      providerId: videoId,
      title: snippet.title ?? "YouTube track",
      artist: snippet.channelTitle ?? "YouTube",
      album: null,
      artwork: thumbnail,
      duration: durations.get(videoId) ?? null,
      streamUrl: null,
      externalUrl: `https://www.youtube.com/watch?v=${videoId}`,
      kind: "video",
      isPreview: false,
    });
  }

  return tracks;
}

export async function searchYouTube(
  query: string,
  limit: number,
  signal: AbortSignal,
): Promise<Track[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return [];

  return cached(`youtube:${query}:${limit}`, 10 * 60 * 1000, async () => {
    const key = cacheKeyFor("youtube:v1", query, limit);

    // Shared cache first: a query already paid for should never be paid twice,
    // even across serverless cold starts.
    const persisted = await readSearchCache<Track[]>(key);
    if (persisted && !persisted.stale) return persisted.value;

    try {
      const tracks = await fetchYouTubeTracks(apiKey, query, limit, signal);
      await writeSearchCache(
        key,
        tracks,
        tracks.length > 0 ? FRESH_TTL_MS : EMPTY_TTL_MS,
      );
      return tracks;
    } catch (error) {
      // Quota exhausted or the key is misconfigured: fall back to the last
      // good answer for this query rather than dropping YouTube entirely.
      const stale = await readSearchCache<Track[]>(key, { allowStale: true });
      if (stale) {
        console.warn(
          "[youtube] serving cached results after failure:",
          error instanceof Error ? error.message : error,
        );
        return stale.value;
      }
      throw error;
    }
  });
}
