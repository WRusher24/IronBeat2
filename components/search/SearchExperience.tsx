"use client";

import { ArrowRight, Loader2, Play, Search, X } from "lucide-react";
import Link from "next/link";
import { useRef } from "react";

import { TrackRow } from "@/components/player/TrackRow";
import type { SearchStatus, SourceStatus } from "@/components/search/useTrackSearch";
import { Button } from "@/components/ui/Button";
import type { Track } from "@/lib/tracks";
import { cn } from "@/lib/utils";

interface SearchExperienceProps {
  query: string;
  onQueryChange: (value: string) => void;
  onClear: () => void;
  tracks: Track[];
  status: SearchStatus;
  error: string | null;
  sources: SourceStatus[];
  tookMs: number | null;
  recentSearches: string[];
  onChipClick: (query: string) => void;
  onPlayTrack: (index: number) => void;
  onPlayAll: () => void;
  activeTrackId: string | null;
  isPlaying: boolean;
  showChips: boolean;
  autoFocus?: boolean;
  compact?: boolean;
  /**
   * How many rows to render inline. The home screen previews a dozen; the
   * dedicated search page renders the whole set.
   */
  maxResults?: number;
  /** Hide the "see all" link when we're already on the full results page. */
  showSeeAll?: boolean;
}

export function SearchExperience({
  query,
  onQueryChange,
  onClear,
  tracks,
  status,
  error,
  sources,
  tookMs,
  recentSearches,
  onChipClick,
  onPlayTrack,
  onPlayAll,
  activeTrackId,
  isPlaying,
  showChips,
  autoFocus,
  compact,
  maxResults = 12,
  showSeeAll = true,
}: SearchExperienceProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const active = query.trim().length >= 2;

  const healthySources = sources.filter((source) => source.status === "ok");
  const failedSources = sources.filter((source) => source.status === "error");
  const skippedSources = sources.filter((source) => source.status === "skipped");

  // "unavailable" (tried, failed) and "not configured" (no key) are different
  // problems with different fixes — never collapse them into one word.
  const sourceSummary = [
    healthySources.map((source) => source.label).join(" · "),
    failedSources.length > 0
      ? `${failedSources.map((source) => source.label).join(", ")} unavailable`
      : "",
    skippedSources.length > 0
      ? `${skippedSources.map((source) => source.label).join(", ")} not configured`
      : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div>
      {/* Hero search bar */}
      <div
        className={cn(
          "relative flex items-center gap-3 rounded-[20px] border bg-white/85 px-4 shadow-chip backdrop-blur transition-colors",
          "border-ink/[0.07] focus-within:border-amber/60 focus-within:bg-white",
          compact ? "h-[52px]" : "h-[58px]",
        )}
      >
        <Search className="h-[19px] w-[19px] shrink-0 text-ink-muted" strokeWidth={2.1} />

        <input
          ref={inputRef}
          value={query}
          autoFocus={autoFocus}
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && tracks.length > 0) onPlayAll();
            if (event.key === "Escape") onClear();
          }}
          type="search"
          enterKeyHint="search"
          placeholder="Search tracks, artists, vibes…"
          aria-label="Search music"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          className="min-w-0 flex-1 bg-transparent text-[15px] font-medium text-ink outline-none placeholder:font-normal placeholder:text-ink-muted/75 [&::-webkit-search-cancel-button]:hidden"
        />

        {status === "loading" ? (
          <Loader2 className="h-[18px] w-[18px] shrink-0 animate-spin text-amber" />
        ) : query.length > 0 ? (
          <button
            type="button"
            onClick={() => {
              onClear();
              inputRef.current?.focus();
            }}
            aria-label="Clear search"
            className="tap grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ink/[0.07] text-ink-muted"
          >
            <X className="h-3.5 w-3.5" strokeWidth={2.6} />
          </button>
        ) : (
          <span className="shrink-0 rounded-full bg-ink/[0.05] px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-ink-muted">
            instant
          </span>
        )}
      </div>

      {/* Recent quick-launch chips */}
      {showChips && recentSearches.length > 0 ? (
        <div className="-mx-5 mt-3 overflow-x-auto px-5 no-scrollbar">
          <div className="flex w-max items-center gap-2">
            <span className="label-xs mr-0.5 shrink-0">Recent</span>
            {recentSearches.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => onChipClick(item)}
                className="tap flex shrink-0 items-center gap-1.5 rounded-full border border-ink/[0.08] bg-white/70 px-3 py-1.5 text-[12.5px] font-medium text-ink/80 hover:border-amber/50 hover:text-ink"
              >
                <span className="text-amber">↗</span>
                {item}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* Results */}
      {active ? (
        <div className="mt-5 animate-fade-up">
          {status === "error" ? (
            <div className="rounded-2xl border border-[#7f2d20]/15 bg-[#7f2d20]/[0.05] px-4 py-3.5">
              <p className="text-[13px] font-semibold text-[#7f2d20]">
                Search didn&apos;t complete
              </p>
              <p className="mt-0.5 text-[12px] text-ink-muted">{error}</p>
            </div>
          ) : null}

          {status === "loading" && tracks.length === 0 ? (
            <div className="space-y-2">
              {[0, 1, 2, 3, 4].map((row) => (
                <div key={row} className="flex items-center gap-3 px-2 py-2">
                  <div className="skeleton h-12 w-12 rounded-[13px]" />
                  <div className="flex-1 space-y-2">
                    <div className="skeleton h-3 w-2/3" />
                    <div className="skeleton h-2.5 w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {status === "success" && tracks.length === 0 ? (
            <div className="rounded-2xl border border-ink/[0.07] bg-white/60 px-4 py-6 text-center">
              <p className="text-[14px] font-semibold text-ink">No audio found</p>
              <p className="mt-1 text-[12.5px] text-ink-muted">
                Try a broader phrase — &ldquo;phonk&rdquo;, &ldquo;hard rock&rdquo;, or
                an artist name.
              </p>
            </div>
          ) : null}

          {tracks.length > 0 ? (
            <>
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-ink">
                    {tracks.length} tracks
                    {tookMs !== null ? (
                      <span className="ml-1.5 font-normal text-ink-muted">
                        · {(tookMs / 1000).toFixed(1)}s
                      </span>
                    ) : null}
                  </p>
                  <p className="truncate text-[10.5px] text-ink-muted">
                    {sourceSummary}
                  </p>
                  {failedSources[0]?.message ? (
                    <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-[#7f2d20]/75">
                      {failedSources[0].message}
                    </p>
                  ) : null}
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <Button size="sm" variant="dark" onClick={onPlayAll}>
                    <Play className="h-3 w-3 fill-current" strokeWidth={0} />
                    Play all
                  </Button>
                  <Link
                    href={`/search?q=${encodeURIComponent(query.trim())}`}
                    className="tap hidden items-center gap-1 rounded-full px-2 py-1 text-[11.5px] font-semibold text-amber-deep sm:flex"
                  >
                    Open
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>

              <div className="space-y-0.5">
                {tracks.slice(0, maxResults).map((track, index) => (
                  <TrackRow
                    key={track.id}
                    track={track}
                    index={index}
                    isActive={activeTrackId === track.id}
                    isPlaying={isPlaying}
                    onPlay={() => onPlayTrack(index)}
                  />
                ))}
              </div>

              {showSeeAll && tracks.length > maxResults ? (
                <Link
                  href={`/search?q=${encodeURIComponent(query.trim())}`}
                  className="mt-3 flex items-center justify-center gap-1.5 rounded-full border border-ink/10 py-2.5 text-[12.5px] font-semibold text-ink-muted hover:border-amber/50 hover:text-ink"
                >
                  See all {tracks.length} results
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
