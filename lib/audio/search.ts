import type { Track, TrackProvider } from "@/lib/tracks";
import { dedupeTracks, interleave } from "@/lib/tracks";

import { searchArchive } from "./providers/archive";
import { searchAudius } from "./providers/audius";

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
 * Preference order.
 *
 * Both sources stream complete tracks over plain HTTP — no previews, no
 * iframes — so every result in a queue behaves identically in the background
 * and on the lock screen.
 */
const PRIORITY: TrackProvider[] = ["audius", "archive"];

const LABELS: Record<TrackProvider, string> = {
  audius: "Audius",
  archive: "Archive.org",
};

type ProviderSearch = (
  query: string,
  limit: number,
  signal: AbortSignal,
) => Promise<Track[]>;

const SEARCHERS: Record<TrackProvider, ProviderSearch> = {
  audius: searchAudius,
  archive: searchArchive,
};

/**
 * Fans out to every source in parallel, then interleaves + de-dupes.
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

  const perProviderLimit = Math.min(Math.max(Math.ceil(limit / 2), 10), 25);

  const settled = await Promise.allSettled(
    PRIORITY.map(async (provider) => {
      const tracks = await SEARCHERS[provider](query, perProviderLimit, signal);
      return { provider, tracks };
    }),
  );

  const groups: Track[][] = [];
  const sources: SourceStatus[] = [];

  for (const [index, provider] of PRIORITY.entries()) {
    const outcome = settled[index];

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
    enabled: true,
  }));
}
