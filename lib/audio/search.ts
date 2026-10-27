import type { Track, TrackProvider } from "@/lib/tracks";
import { dedupeTracks, interleave } from "@/lib/tracks";

import { searchArchive } from "./providers/archive";
import { searchDeezer } from "./providers/deezer";
import { searchItunes } from "./providers/itunes";
import { isYouTubeConfigured, searchYouTube } from "./providers/youtube";

export type SourceStatusKind = "ok" | "skipped" | "error";

export interface SourceStatus {
  provider: TrackProvider;
  label: string;
  status: SourceStatusKind;
  count: number;
  message?: string;
}

export interface SearchResult {
  tracks: Track[];
  sources: SourceStatus[];
  tookMs: number;
}

/**
 * Preference order. YouTube first (full length) when configured, then the two
 * preview catalogues, then the open archive.
 */
const PRIORITY: TrackProvider[] = ["youtube", "deezer", "itunes", "archive"];

const LABELS: Record<TrackProvider, string> = {
  youtube: "YouTube",
  deezer: "Deezer",
  itunes: "Apple Music",
  archive: "Archive.org",
};

type ProviderSearch = (
  query: string,
  limit: number,
  signal: AbortSignal,
) => Promise<Track[]>;

const SEARCHERS: Record<TrackProvider, ProviderSearch> = {
  youtube: searchYouTube,
  deezer: searchDeezer,
  itunes: searchItunes,
  archive: searchArchive,
};

function isEnabled(provider: TrackProvider): boolean {
  if (provider === "youtube") return isYouTubeConfigured();
  return true;
}

/**
 * Fans out to every enabled source in parallel, then interleaves + de-dupes.
 *
 * Individual provider failures are non-fatal: the response reports per-source
 * status so the UI can be honest about what it could reach.
 */
export async function searchTracks(
  query: string,
  options: { limit?: number; signal?: AbortSignal } = {},
): Promise<SearchResult> {
  const startedAt = Date.now();
  const limit = Math.min(Math.max(options.limit ?? 24, 1), 50);
  const signal = options.signal ?? new AbortController().signal;

  const enabled = PRIORITY.filter(isEnabled);
  const perProviderLimit = Math.min(Math.max(Math.ceil(limit / 2), 10), 25);

  const settled = await Promise.allSettled(
    enabled.map(async (provider) => {
      const tracks = await SEARCHERS[provider](query, perProviderLimit, signal);
      return { provider, tracks };
    }),
  );

  const groups: Track[][] = [];
  const sources: SourceStatus[] = [];

  // Preserve priority ordering regardless of which promise resolved first.
  for (const provider of PRIORITY) {
    if (!isEnabled(provider)) {
      sources.push({
        provider,
        label: LABELS[provider],
        status: "skipped",
        count: 0,
        message: "No API key configured",
      });
      continue;
    }

    const index = enabled.indexOf(provider);
    const outcome = settled[index];

    if (!outcome) {
      sources.push({
        provider,
        label: LABELS[provider],
        status: "error",
        count: 0,
        message: "Source unavailable",
      });
      continue;
    }

    if (outcome.status === "fulfilled") {
      groups.push(outcome.value.tracks);
      sources.push({
        provider,
        label: LABELS[provider],
        status: "ok",
        count: outcome.value.tracks.length,
      });
    } else {
      groups.push([]);
      sources.push({
        provider,
        label: LABELS[provider],
        status: "error",
        count: 0,
        message:
          outcome.reason instanceof Error
            ? outcome.reason.message.slice(0, 140)
            : "Source unavailable",
      });
    }
  }

  const tracks = dedupeTracks(interleave(groups)).slice(0, limit);

  return { tracks, sources, tookMs: Date.now() - startedAt };
}

/**
 * Expands a set of seed queries (used by moods + Smart Shuffle) into one
 * blended queue. Seeds run in parallel; results are round-robined so no single
 * seed dominates.
 */
export async function searchSeeds(
  seeds: string[],
  options: { perSeed?: number; total?: number; signal?: AbortSignal } = {},
): Promise<SearchResult> {
  const startedAt = Date.now();
  const perSeed = Math.min(Math.max(options.perSeed ?? 12, 4), 20);
  const total = Math.min(Math.max(options.total ?? 36, 1), 60);
  const signal = options.signal ?? new AbortController().signal;

  const settled = await Promise.allSettled(
    seeds.map((seed) => searchTracks(seed, { limit: perSeed, signal })),
  );

  const groups: Track[][] = [];
  const sources: SourceStatus[] = [];

  for (const outcome of settled) {
    if (outcome.status === "fulfilled") {
      groups.push(outcome.value.tracks);
      for (const source of outcome.value.sources) {
        const existing = sources.find((item) => item.provider === source.provider);
        if (!existing) {
          sources.push({ ...source });
        } else {
          existing.count += source.count;
          if (source.status === "ok") existing.status = "ok";
        }
      }
    }
  }

  const tracks = dedupeTracks(interleave(groups)).slice(0, total);

  return { tracks, sources, tookMs: Date.now() - startedAt };
}

/** Lightweight capability probe used by the search UI footer. */
export function getSourceCapabilities(): Array<{
  provider: TrackProvider;
  label: string;
  enabled: boolean;
}> {
  return PRIORITY.map((provider) => ({
    provider,
    label: LABELS[provider],
    enabled: isEnabled(provider),
  }));
}
