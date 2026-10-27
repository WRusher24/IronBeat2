import type { Track } from "@/lib/tracks";
import { makeTrackId } from "@/lib/tracks";

import { cached } from "../cache";

/**
 * Apple iTunes Search API — no key required, 30-second preview clips.
 *
 * Docs: https://performance-partners.apple.com/search-api
 * The preview URLs are CORS-friendly MP3/M4A and play directly in an
 * HTMLAudioElement, which makes this the most reliable source for
 * "tap a result, hear audio immediately".
 */

interface ItunesResult {
  wrapperType?: string;
  kind?: string;
  trackId?: number;
  trackName?: string;
  artistName?: string;
  collectionName?: string;
  artworkUrl100?: string;
  previewUrl?: string;
  trackTimeMillis?: number;
  trackViewUrl?: string;
}

interface ItunesResponse {
  resultCount?: number;
  results?: ItunesResult[];
}

/** iTunes serves 100x100 crops; the same asset is available at 600x600. */
function upscaleArtwork(url: string | undefined): string | null {
  if (!url) return null;
  return url.replace(/\/\d+x\d+bb\.(jpg|png)$/i, "/600x600bb.jpg");
}

export async function searchItunes(
  query: string,
  limit: number,
  signal: AbortSignal,
): Promise<Track[]> {
  const url = new URL("https://itunes.apple.com/search");
  url.searchParams.set("term", query);
  url.searchParams.set("media", "music");
  url.searchParams.set("entity", "song");
  url.searchParams.set("limit", String(Math.min(limit, 50)));
  url.searchParams.set("country", "US");

  return cached(`itunes:${query}:${limit}`, 10 * 60 * 1000, async () => {
    const response = await fetch(url, {
      signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "IronBeat/1.0 (workout music PWA)",
      },
      next: { revalidate: 600 },
    });

    if (!response.ok) {
      throw new Error(`iTunes responded ${response.status}`);
    }

    const data = (await response.json()) as ItunesResponse;
    const results = data.results ?? [];
    const tracks: Track[] = [];

    for (const item of results) {
      if (!item.previewUrl || !item.trackId || !item.trackName) continue;
      if (item.kind && item.kind !== "song") continue;

      const duration =
        typeof item.trackTimeMillis === "number"
          ? Math.max(1, Math.round(item.trackTimeMillis / 1000))
          : null;

      tracks.push({
        id: makeTrackId("itunes", String(item.trackId)),
        provider: "itunes",
        providerId: String(item.trackId),
        title: item.trackName,
        artist: item.artistName ?? "Unknown artist",
        album: item.collectionName ?? null,
        artwork: upscaleArtwork(item.artworkUrl100),
        // iTunes previews are clipped to ~30s regardless of the full track
        // length, so we report the honest playable duration.
        duration: duration && duration < 45 ? duration : 30,
        streamUrl: item.previewUrl,
        externalUrl: item.trackViewUrl ?? null,
        kind: "audio",
        isPreview: true,
      });
    }

    return tracks;
  });
}
