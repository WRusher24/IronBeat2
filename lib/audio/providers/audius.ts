import type { Track } from "@/lib/tracks";
import { makeTrackId } from "@/lib/tracks";

import { cached } from "../cache";

/**
 * Audius — full-length streaming, no API key required.
 *
 * Docs: https://docs.audius.org/api/
 *
 * Why this source exists: IronBeat only ships catalogues that can hand over a
 * complete, directly playable audio file. Preview-only APIs (Apple Music,
 * Deezer) were removed because a 30-second clip is useless between heavy sets,
 * and iframe-backed sources (YouTube) cannot keep playing once iOS suspends the
 * page — which breaks lock-screen playback.
 *
 * Stream URLs point at the stable API endpoint rather than the signed CDN URL
 * it redirects to. The signature expires in minutes, so storing the resolved
 * URL would leave every saved track dead within the hour; the endpoint issues
 * a fresh redirect on each request and stays valid forever.
 */

const APP_NAME = process.env.AUDIUS_APP_NAME ?? "IronBeat";

interface AudiusArtwork {
  "150x150"?: string;
  "480x480"?: string;
  "1000x1000"?: string;
}

interface AudiusTrack {
  id?: string;
  title?: string;
  duration?: number;
  genre?: string;
  mood?: string;
  permalink?: string;
  artwork?: AudiusArtwork;
  access?: { stream?: boolean; download?: boolean };
  is_streamable?: boolean;
  user?: { name?: string; handle?: string };
}

interface AudiusSearchResponse {
  data?: AudiusTrack[];
}

function pickArtwork(artwork: AudiusArtwork | undefined): string | null {
  if (!artwork) return null;
  return (
    artwork["1000x1000"] ?? artwork["480x480"] ?? artwork["150x150"] ?? null
  );
}

export async function searchAudius(
  query: string,
  limit: number,
  signal: AbortSignal,
): Promise<Track[]> {
  return cached(`audius:${query}:${limit}`, 10 * 60 * 1000, async () => {
    const url = new URL("https://api.audius.co/v1/tracks/search");
    url.searchParams.set("query", query);
    url.searchParams.set("app_name", APP_NAME);
    url.searchParams.set("limit", String(Math.min(Math.max(limit, 1), 30)));

    const response = await fetch(url, {
      signal: AbortSignal.any([signal, AbortSignal.timeout(6000)]),
      headers: {
        Accept: "application/json",
        "User-Agent": "IronBeat/1.0 (workout music PWA)",
      },
      next: { revalidate: 600 },
    });

    if (!response.ok) {
      throw new Error(`Audius responded ${response.status}`);
    }

    const payload = (await response.json()) as AudiusSearchResponse;
    const tracks: Track[] = [];

    for (const item of payload.data ?? []) {
      if (!item.id || !item.title) continue;
      if (item.access?.stream === false) continue;
      if (item.is_streamable === false) continue;

      const duration =
        typeof item.duration === "number" && item.duration > 0
          ? Math.round(item.duration)
          : null;

      tracks.push({
        id: makeTrackId("audius", item.id),
        provider: "audius",
        providerId: item.id,
        title: item.title,
        artist: item.user?.name ?? item.user?.handle ?? "Audius artist",
        album: null,
        artwork: pickArtwork(item.artwork),
        duration,
        streamUrl: `https://api.audius.co/v1/tracks/${encodeURIComponent(item.id)}/stream?app_name=${encodeURIComponent(APP_NAME)}`,
        externalUrl: item.permalink
          ? `https://audius.co${item.permalink}`
          : `https://audius.co/tracks/${item.id}`,
        kind: "audio",
        isPreview: false,
      });
    }

    return tracks;
  });
}
