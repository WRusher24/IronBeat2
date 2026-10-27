import type { Track, TrackProvider } from "@/lib/tracks";
import { dedupeTracks, interleave } from "@/lib/tracks";

import { searchArchive } from "./providers/archive";
import { searchAudius } from "./providers/audius";
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
 * Preference order — YouTube first.
 *
 * `interleave()` walks this list, so YouTube leads the results, and
 * `dedupeTracks()` keeps the first occurrence, so a track available on both
 * YouTube and Audius resolves to the YouTube copy.
 */
const PRIORITY: TrackProvider[] = ["youtube", "audius", "archive"];

const LABELS: Record<TrackProvider, string> = {
  youtube: "YouTube",
  audius: "Audius",
  archive: "Archive.org",
};

type ProviderSearch = (
  query: string,
  limit: number,
  signal: AbortSignal,
) => Promise<Track[]>;

const SEARCHERS: Record<TrackProvider, ProviderSearch> = {
  youtube: searchYouTube,
  audius: searchAudius,
  archive: searchArchive,
};

/** YouTube needs an API key; the other two are keyless and always enabled. */
function isConfigured(provider: TrackProvider): boolean {
  if (provider === "youtube") return isYouTubeConfigured();
  return true;
}

/**
 * How many seeds of a mood/shuffle expansion may hit YouTube.
 *
 * YouTube charges 100 units per search against a 10,000/day default, and a
 * mood has five seeds. Capping keeps a full pass over the deck inside the daily
 * allowance while still giving every mood a healthy share of YouTube tracks.
 */
const YOUTUBE_SEEDS_PER_EXPANSION = 3;

/**
 * Fans out to every source in parallel, then interleaves + de-dupes.
 *
 * Individual provider failures are non-fatal: the response reports per-source
 * status so the UI can be honest about what it could reach.
 */
export async function searchTracks(
  query: string,
  options: {
    limit?: number;
    signal?: AbortSignal;
    /** Skip YouTube for this call — used to budget quota across seed sets. */
    skipYouTube?: boolean;
  } = {},
): Promise<SearchResult> {
  const startedAt = Date.now();
  const limit = Math.min(Math.max(options.limit ?? 24, 1), 50);
  const signal = options.signal ?? new AbortController().signal;

  const perProviderLimit = Math.min(Math.max(Math.ceil(limit / 2), 10), 25);

  const enabledFor = (provider: TrackProvider): boolean =>
    provider === "youtube"
      ? !options.skipYouTube && isConfigured(provider)
      : true;

  const enabled = PRIORITY.filter(enabledFor);

  const settled = await Promise.allSettled(
    enabled.map(async (provider) => {
      const tracks = await SEARCHERS[provider](query, perProviderLimit, signal);
      return { provider, tracks };
    }),
  );

  const groups: Track[][] = [];
  const sources: SourceStatus[] = [];

  // Walk PRIORITY (not `enabled`) so the response still reports sources that
  // were skipped, and ordering stays deterministic.
  for (const provider of PRIORITY) {
    if (!enabledFor(provider)) {
      groups.push([]);
      sources.push({
        provider,
        label: LABELS[provider],
        status: "skipped",
        count: 0,
        message:
          provider === "youtube"
            ? isConfigured(provider)
              ? "Skipped to conserve YouTube quota"
              : "Set YOUTUBE_API_KEY to enable this source"
            : "Not configured",
      });
      continue;
    }

    const outcome = settled[enabled.indexOf(provider)];

    if (!outcome) {
      groups.push([]);
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
  options: {
    perSeed?: number;
    total?: number;
    signal?: AbortSignal;
    youtubeSeedLimit?: number;
  } = {},
): Promise<SearchResult> {
  const startedAt = Date.now();
  const perSeed = Math.min(Math.max(options.perSeed ?? 12, 4), 20);
  const total = Math.min(Math.max(options.total ?? 36, 1), 60);
  const signal = options.signal ?? new AbortController().signal;
  const youtubeSeedLimit =
    options.youtubeSeedLimit ?? YOUTUBE_SEEDS_PER_EXPANSION;

  const settled = await Promise.allSettled(
    seeds.map((seed, index) =>
      searchTracks(seed, {
        limit: perSeed,
        signal,
        skipYouTube: index >= youtubeSeedLimit,
      }),
    ),
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
