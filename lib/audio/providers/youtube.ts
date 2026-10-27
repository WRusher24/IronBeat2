import type { Track } from "@/lib/tracks";
import { makeTrackId } from "@/lib/tracks";

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

export async function searchYouTube(
  query: string,
  limit: number,
  signal: AbortSignal,
): Promise<Track[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return [];

  return cached(`youtube:${query}:${limit}`, 10 * 60 * 1000, async () => {
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
      throw new Error(`YouTube search responded ${searchResponse.status}`);
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
  });
}
