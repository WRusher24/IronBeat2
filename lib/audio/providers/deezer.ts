import type { Track } from "@/lib/tracks";
import { makeTrackId } from "@/lib/tracks";

import { cached } from "../cache";

/**
 * Deezer public search API — no key required, 30-second previews.
 *
 * Docs: https://developers.deezer.com/api/search
 * Deezer blocks browser-origin requests, so this must only ever be called
 * from the server. The `preview` field is a plain MP3 that plays in an
 * HTMLAudioElement.
 */

interface DeezerTrack {
  id?: number;
  title?: string;
  duration?: number;
  preview?: string;
  link?: string;
  readable?: boolean;
  artist?: { name?: string };
  album?: { title?: string; cover_xl?: string; cover_big?: string };
}

interface DeezerResponse {
  data?: DeezerTrack[];
  total?: number;
  error?: { type?: string; message?: string; code?: number };
}

export async function searchDeezer(
  query: string,
  limit: number,
  signal: AbortSignal,
): Promise<Track[]> {
  const url = new URL("https://api.deezer.com/search");
  url.searchParams.set("q", query);
  url.searchParams.set("limit", String(Math.min(limit, 50)));

  return cached(`deezer:${query}:${limit}`, 10 * 60 * 1000, async () => {
    const response = await fetch(url, {
      signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "IronBeat/1.0 (workout music PWA)",
      },
      next: { revalidate: 600 },
    });

    if (!response.ok) {
      throw new Error(`Deezer responded ${response.status}`);
    }

    const data = (await response.json()) as DeezerResponse;

    // Deezer returns HTTP 200 with an error envelope when quota-limited.
    if (data.error || !data.data) {
      throw new Error(data.error?.message ?? "Deezer returned no data");
    }

    const tracks: Track[] = [];

    for (const item of data.data) {
      if (!item.id || !item.preview || !item.title) continue;
      if (item.readable === false) continue;

      tracks.push({
        id: makeTrackId("deezer", String(item.id)),
        provider: "deezer",
        providerId: String(item.id),
        title: item.title,
        artist: item.artist?.name ?? "Unknown artist",
        album: item.album?.title ?? null,
        artwork: item.album?.cover_xl ?? item.album?.cover_big ?? null,
        duration: 30,
        streamUrl: item.preview,
        externalUrl: item.link ?? `https://www.deezer.com/track/${item.id}`,
        kind: "audio",
        isPreview: true,
      });
    }

    return tracks;
  });
}
