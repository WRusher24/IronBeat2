import type { Track } from "@/lib/tracks";
import { makeTrackId } from "@/lib/tracks";

import { cached } from "../cache";

/**
 * Internet Archive — open audio archive, full-length tracks, no key required.
 *
 * Two-step protocol:
 *   1. advancedsearch.php  -> candidate item identifiers
 *   2. metadata/{id}       -> file list, from which we pick the best MP3
 *
 * Item metadata is effectively immutable, so it is cached aggressively while
 * search results get a short TTL.
 */

interface ArchiveDoc {
  identifier?: string;
  title?: string;
  creator?: string | string[];
  year?: string | number;
  downloads?: number;
}

interface ArchiveSearchResponse {
  response?: {
    numFound?: number;
    docs?: ArchiveDoc[];
  };
}

interface ArchiveFile {
  name?: string;
  format?: string;
  size?: string;
  length?: string;
  title?: string;
  artist?: string;
  creator?: string;
  album?: string;
  track?: string;
}

interface ArchiveMetadata {
  files?: ArchiveFile[];
  metadata?: {
    title?: string;
    creator?: string | string[];
    year?: string;
  };
}

function firstString(value: string | string[] | undefined): string | null {
  if (!value) return null;
  if (Array.isArray(value)) return value.find((v) => typeof v === "string") ?? null;
  return value;
}

function buildDownloadUrl(identifier: string, fileName: string): string {
  const encodedPath = fileName
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `https://archive.org/download/${encodeURIComponent(identifier)}/${encodedPath}`;
}

/** Picks the best playable MP3 from an item's file list. */
function pickAudioFile(files: ArchiveFile[]): ArchiveFile | null {
  const candidates = files.filter((file) => {
    if (!file.name) return false;
    const name = file.name.toLowerCase();
    if (!name.endsWith(".mp3")) return false;
    if (name.includes("_sample") || name.includes("sample.")) return false;

    const size = Number(file.size ?? 0);
    // Skip thumbnails/tiny artefacts and anything too large to stream quickly.
    if (size > 0 && (size < 400_000 || size > 28_000_000)) return false;

    const length = Number.parseFloat(file.length ?? "0");
    if (Number.isFinite(length) && length > 0 && length < 25) return false;

    return true;
  });

  if (candidates.length === 0) return null;

  // Prefer full-length original MP3s, then the largest remaining file.
  candidates.sort((a, b) => {
    const aOriginal = a.format === "VBR MP3" || a.format === "MP3" ? 1 : 0;
    const bOriginal = b.format === "VBR MP3" || b.format === "MP3" ? 1 : 0;
    if (aOriginal !== bOriginal) return bOriginal - aOriginal;
    return Number(b.size ?? 0) - Number(a.size ?? 0);
  });

  return candidates[0];
}

async function fetchItemTrack(
  doc: ArchiveDoc,
  signal: AbortSignal,
): Promise<Track | null> {
  const identifier = doc.identifier;
  if (!identifier) return null;

  const meta = await cached<ArchiveMetadata | null>(
    `archive:meta:${identifier}`,
    24 * 60 * 60 * 1000,
    async () => {
      const response = await fetch(
        `https://archive.org/metadata/${encodeURIComponent(identifier)}`,
        {
          signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]),
          headers: { Accept: "application/json" },
          next: { revalidate: 86400 },
        },
      );
      if (!response.ok) return null;
      return (await response.json()) as ArchiveMetadata;
    },
  );

  if (!meta?.files) return null;

  const file = pickAudioFile(meta.files);
  if (!file?.name) return null;

  const rawTitle =
    file.title ?? meta.metadata?.title ?? doc.title ?? file.name.replace(/\.mp3$/i, "");
  const artist =
    file.artist ??
    file.creator ??
    firstString(doc.creator) ??
    firstString(meta.metadata?.creator) ??
    "Internet Archive";

  const length = Number.parseFloat(file.length ?? "0");
  const duration = Number.isFinite(length) && length > 0 ? Math.round(length) : null;

  return {
    id: makeTrackId("archive", `${identifier}/${file.name}`),
    provider: "archive",
    providerId: `${identifier}/${file.name}`,
    title: rawTitle.slice(0, 200),
    artist: artist.slice(0, 200),
    album: file.album ?? null,
    artwork: `https://archive.org/services/img/${encodeURIComponent(identifier)}`,
    duration,
    streamUrl: buildDownloadUrl(identifier, file.name),
    externalUrl: `https://archive.org/details/${encodeURIComponent(identifier)}`,
    kind: "audio",
    isPreview: false,
  };
}

export async function searchArchive(
  query: string,
  limit: number,
  signal: AbortSignal,
): Promise<Track[]> {
  const itemCount = Math.min(Math.max(limit, 4), 8);

  const docs = await cached<ArchiveDoc[]>(
    `archive:search:${query}:${itemCount}`,
    10 * 60 * 1000,
    async () => {
      const url = new URL("https://archive.org/advancedsearch.php");
      url.searchParams.set(
        "q",
        `(${query}) AND mediatype:(audio) AND (collection:(opensource_audio) OR collection:(audio_music) OR collection:(netlabels)) AND NOT collection:(podcasts)`,
      );
      url.searchParams.append("fl[]", "identifier");
      url.searchParams.append("fl[]", "title");
      url.searchParams.append("fl[]", "creator");
      url.searchParams.append("fl[]", "year");
      url.searchParams.append("fl[]", "downloads");
      url.searchParams.set("rows", String(itemCount));
      url.searchParams.set("page", "1");
      url.searchParams.set("output", "json");
      url.searchParams.append("sort[]", "downloads desc");

      const response = await fetch(url, {
        signal: AbortSignal.any([signal, AbortSignal.timeout(6000)]),
        headers: {
          Accept: "application/json",
          "User-Agent": "IronBeat/1.0 (workout music PWA)",
        },
        next: { revalidate: 600 },
      });

      if (!response.ok) {
        throw new Error(`Archive.org responded ${response.status}`);
      }

      const data = (await response.json()) as ArchiveSearchResponse;
      return data.response?.docs ?? [];
    },
  );

  if (docs.length === 0) return [];

  const settled = await Promise.allSettled(
    docs.map((doc) =>
      fetchItemTrack(doc, signal).catch(() => null),
    ),
  );

  const tracks: Track[] = [];
  for (const result of settled) {
    if (result.status === "fulfilled" && result.value) {
      tracks.push(result.value);
    }
  }

  return tracks;
}
