"use client";

import { Flame, Sparkles } from "lucide-react";
import { useState } from "react";

import { usePlayerEngine, usePlayerState } from "@/components/providers/PlayerProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { SearchExperience } from "@/components/search/SearchExperience";
import { useTrackSearch } from "@/components/search/useTrackSearch";
import { apiFetch, errorMessage } from "@/lib/api-client";
import type { Track } from "@/lib/tracks";

const SUGGESTIONS = [
  "brazilian phonk",
  "gym motivational speech",
  "hard rock workout",
  "nasheed",
  "drum and bass sprint",
  "old school hip hop",
  "lofi cool down",
  "dark trap",
  "80s rock anthem",
  "deep house cardio",
];

export function SearchPageView({
  initialQuery,
  recentSearches,
}: {
  initialQuery: string;
  recentSearches: string[];
}) {
  const engine = usePlayerEngine();
  const player = usePlayerState();
  const toast = useToast();
  const search = useTrackSearch(initialQuery);
  const [chips, setChips] = useState<string[]>(recentSearches);
  const [mixLoading, setMixLoading] = useState(false);

  const rememberChip = (raw: string) => {
    const value = raw.trim();
    if (value.length < 2) return;
    setChips((current) => [
      value,
      ...current.filter((item) => item.toLowerCase() !== value.toLowerCase()),
    ].slice(0, 8));
  };

  const launch = async (query: string) => {
    engine.unlock();
    search.setQuery(query);
    const data = await search.search(query);

    if (data && data.tracks.length > 0) {
      engine.setQueue(data.tracks, 0, `“${query}”`);
      rememberChip(query);
    } else {
      toast("No audio found for that one", "error");
    }
  };

  const handleSmartShuffle = async () => {
    engine.unlock();
    setMixLoading(true);

    try {
      const data = await apiFetch<{
        tracks: Track[];
        basis: string[];
        sources?: Array<{ provider: string; status: string }>;
      }>("/api/mix/smart-shuffle");

      if (data.tracks.length === 0) {
        toast("Couldn't build a mix right now", "error");
        return;
      }

      engine.setQueue(data.tracks, 0, "Smart Shuffle", { shuffle: true });

      const youtubeDown = data.sources?.some(
        (source) => source.provider === "youtube" && source.status === "error",
      );

      toast(
        `Shuffled from your history${youtubeDown ? " — YouTube unavailable" : ""}`,
        youtubeDown ? "default" : "success",
      );
    } catch (error) {
      toast(errorMessage(error), "error");
    } finally {
      setMixLoading(false);
    }
  };

  return (
    <div>
      <header className="pt-[calc(env(safe-area-inset-top)_+_20px)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-muted">
          Search
        </p>
        <h1 className="mt-1 font-display text-[32px] leading-[1.04] tracking-[-0.02em] text-ink">
          Find your next set.
        </h1>
      </header>

      <div className="mt-4">
        <SearchExperience
          query={search.query}
          onQueryChange={search.setQuery}
          onClear={search.reset}
          tracks={search.tracks}
          status={search.status}
          error={search.error}
          sources={search.sources}
          tookMs={search.tookMs}
          recentSearches={chips}
          onChipClick={(query) => void launch(query)}
          onPlayTrack={(index) => engine.setQueue(search.tracks, index, `“${search.query.trim()}”`)}
          onPlayAll={() => {
            engine.setQueue(search.tracks, 0, `“${search.query.trim()}”`);
            rememberChip(search.query);
          }}
          activeTrackId={player.current?.id ?? null}
          isPlaying={player.isPlaying}
          showChips={!search.active}
          compact
          maxResults={50}
          showSeeAll={false}
        />
      </div>

      {!search.active ? (
        <div className="mt-7 space-y-6">
          <section>
            <div className="mb-3 flex items-center gap-1.5">
              <Flame className="h-3.5 w-3.5 text-amber" strokeWidth={2.3} />
              <h2 className="label-xs">Try a proven search</h2>
            </div>

            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => void launch(suggestion)}
                  className="tap rounded-full border border-ink/[0.08] bg-white/70 px-3.5 py-2 text-[12.5px] font-medium text-ink/80 hover:border-amber/50 hover:text-ink"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </section>

          <button
            type="button"
            onClick={() => void handleSmartShuffle()}
            disabled={mixLoading}
            className="flex w-full items-center gap-3 rounded-2xl bg-ink px-4 py-3.5 text-left text-cream disabled:opacity-70"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-cream/10">
              <Sparkles className="h-4 w-4 text-amber-soft" strokeWidth={2.2} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13.5px] font-semibold">
                {mixLoading ? "Building your mix…" : "Smart Shuffle"}
              </span>
              <span className="block text-[11px] text-cream/50">
                A one-off mix from your own history
              </span>
            </span>
          </button>

          <p className="px-1 text-[11.5px] leading-relaxed text-ink-muted">
            IronBeat searches YouTube first, then Audius and the Internet Archive
            at the same time, and blends the results into one queue.
          </p>
        </div>
      ) : null}
    </div>
  );
}
