"use client";

import { ArrowUpRight, ListMusic, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { MoodDeck } from "@/components/home/MoodDeck";
import { RecentRail } from "@/components/home/RecentRail";
import { SmartShuffleCard } from "@/components/home/SmartShuffleCard";
import { usePlayerEngine, usePlayerState } from "@/components/providers/PlayerProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { SearchExperience } from "@/components/search/SearchExperience";
import { useTrackSearch } from "@/components/search/useTrackSearch";
import { MOODS, type Mood } from "@/lib/moods";
import { apiFetch, errorMessage } from "@/lib/api-client";
import type { Track } from "@/lib/tracks";
import { cn } from "@/lib/utils";

interface HomePlaylist {
  id: string;
  name: string;
  trackCount: number;
  accent: string;
}

interface HomeViewProps {
  displayName: string;
  recentSearches: string[];
  recentPlays: Track[];
  playlists: HomePlaylist[];
  playCount: number;
}

function greetingFor(hour: number): string {
  if (hour < 5) return "Still up";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 22) return "Good evening";
  return "Late session";
}

export function HomeView({
  displayName,
  recentSearches,
  recentPlays,
  playlists,
  playCount,
}: HomeViewProps) {
  const engine = usePlayerEngine();
  const player = usePlayerState();
  const toast = useToast();
  const search = useTrackSearch();

  const [chips, setChips] = useState<string[]>(recentSearches);
  const [moodLoading, setMoodLoading] = useState<string | null>(null);
  const [mixLoading, setMixLoading] = useState(false);
  const [mixBasis, setMixBasis] = useState<string[] | null>(null);
  const [greeting, setGreeting] = useState("Welcome back");

  useEffect(() => {
    setGreeting(greetingFor(new Date().getHours()));
  }, []);

  const firstName = useMemo(() => {
    const cleaned = displayName.trim().split(/\s+/)[0];
    return cleaned.length > 0 ? cleaned : "athlete";
  }, [displayName]);

  const rememberChip = (raw: string) => {
    const value = raw.trim();
    if (value.length < 2) return;

    setChips((current) => {
      const without = current.filter(
        (item) => item.toLowerCase() !== value.toLowerCase(),
      );
      return [value, ...without].slice(0, 8);
    });
  };

  const handlePlayTrack = (index: number) => {
    const label = `“${search.query.trim()}”`;
    engine.setQueue(search.tracks, index, label);
  };

  const handlePlayAll = () => {
    if (search.tracks.length === 0) return;
    engine.setQueue(search.tracks, 0, `“${search.query.trim()}”`);
    rememberChip(search.query);
  };

  const handleChip = async (query: string) => {
    // Unlock audio inside the tap so playback isn't blocked after the await.
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

  const handleMood = async (mood: Mood) => {
    engine.unlock();
    setMoodLoading(mood.slug);

    try {
      const data = await apiFetch<{
        tracks: Track[];
        sources?: Array<{ provider: string; status: string }>;
      }>(`/api/moods/${mood.slug}`);

      if (data.tracks.length === 0) {
        toast("That vibe came back empty — try another", "error");
        return;
      }

      engine.setQueue(data.tracks, 0, `${mood.emoji} ${mood.title}`);

      // YouTube is the priority source, so a silent fallback would look like it
      // vanished. Say so instead.
      const youtubeDown = data.sources?.some(
        (source) => source.provider === "youtube" && source.status === "error",
      );

      toast(
        `${mood.title} · ${data.tracks.length} tracks${youtubeDown ? " — YouTube unavailable" : ""}`,
        youtubeDown ? "default" : "success",
      );
    } catch (error) {
      toast(errorMessage(error), "error");
    } finally {
      setMoodLoading(null);
    }
  };

  const handleSmartShuffle = async () => {
    engine.unlock();
    setMixLoading(true);

    try {
      const data = await apiFetch<{
        tracks: Track[];
        basis: string[];
        coldStart: boolean;
        sources?: Array<{ provider: string; status: string }>;
      }>("/api/mix/smart-shuffle");

      setMixBasis(data.basis);

      if (data.tracks.length === 0) {
        toast("Couldn't build a mix right now", "error");
        return;
      }

      engine.setQueue(data.tracks, 0, "Smart Shuffle", { shuffle: true });

      const youtubeDown = data.sources?.some(
        (source) => source.provider === "youtube" && source.status === "error",
      );

      toast(
        `${
          data.coldStart
            ? "Starter mix — search a few vibes to personalise it"
            : `Mix built from ${data.basis.length} signals`
        }${youtubeDown ? " — YouTube unavailable" : ""}`,
        youtubeDown ? "default" : "success",
      );
    } catch (error) {
      toast(errorMessage(error), "error");
    } finally {
      setMixLoading(false);
    }
  };

  const activeId = player.current?.id ?? null;

  return (
    <div className="pb-2">
      {/* Brand row */}
      <header className="flex items-center justify-between pt-[calc(env(safe-area-inset-top)_+_18px)]">
        <div className="flex items-center gap-2">
          <span className="grid h-6 w-6 place-items-center rounded-[8px] bg-ink">
            <span className="flex h-3 items-end gap-[2px]">
              <span className="h-full w-[2px] rounded-full bg-amber" />
              <span className="h-2/3 w-[2px] rounded-full bg-amber/70" />
              <span className="h-1/3 w-[2px] rounded-full bg-amber/45" />
            </span>
          </span>
          <span className="text-[11px] font-bold uppercase tracking-[0.28em] text-ink">
            IronBeat
          </span>
        </div>

        <Link
          href="/account"
          className="tap grid h-9 w-9 place-items-center rounded-full bg-ink text-[12px] font-bold uppercase text-cream"
          aria-label="Account"
        >
          {firstName.slice(0, 1)}
        </Link>
      </header>

      {/* Greeting */}
      <div className="mt-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
          {greeting}
        </p>
        <h1 className="mt-1 font-display text-[31px] leading-[1.04] tracking-[-0.02em] text-ink">
          {firstName}.
        </h1>
      </div>

      {/* Hero search */}
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
          onChipClick={(query) => void handleChip(query)}
          onPlayTrack={handlePlayTrack}
          onPlayAll={handlePlayAll}
          activeTrackId={activeId}
          isPlaying={player.isPlaying}
          showChips={!search.active}
        />
      </div>

      {!search.active ? (
        <div className="mt-6 space-y-7">
          <SmartShuffleCard
            onLaunch={() => void handleSmartShuffle()}
            loading={mixLoading}
            basis={mixBasis}
            coldStart={playCount === 0}
          />

          <section>
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="section-title">Moods &amp; vibes</h2>
              <span className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
                {MOODS.length} decks
              </span>
            </div>

            <MoodDeck
              moods={MOODS}
              loadingSlug={moodLoading}
              onLaunch={(mood) => void handleMood(mood)}
            />
          </section>

          {playlists.length > 0 ? (
            <section>
              <div className="mb-2.5 flex items-baseline justify-between">
                <h2 className="section-title">Your folders</h2>
                <Link
                  href="/playlists"
                  className="flex items-center gap-0.5 text-[11.5px] font-semibold text-amber-deep"
                >
                  All
                  <ArrowUpRight className="h-3 w-3" />
                </Link>
              </div>

              <div className="-mx-5 overflow-x-auto px-5 no-scrollbar">
                <div className="flex w-max gap-2.5">
                  {playlists.slice(0, 6).map((playlist) => (
                    <Link
                      key={playlist.id}
                      href={`/playlists/${playlist.id}`}
                      className="tap flex w-[168px] shrink-0 items-center gap-2.5 rounded-2xl border border-ink/[0.07] bg-white/70 p-2.5"
                    >
                      <span
                        className={cn(
                          "grid h-9 w-9 shrink-0 place-items-center rounded-xl",
                          playlist.accent === "ember"
                            ? "bg-[#B4552F]/15 text-[#B4552F]"
                            : playlist.accent === "moss"
                              ? "bg-[#7E7A5A]/15 text-[#6C6849]"
                              : playlist.accent === "ocean"
                                ? "bg-[#6F7C80]/15 text-[#5A676B]"
                                : "bg-amber/15 text-amber-deep",
                        )}
                      >
                        <ListMusic className="h-4 w-4" strokeWidth={2.1} />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[12.5px] font-semibold text-ink">
                          {playlist.name}
                        </span>
                        <span className="block text-[10px] text-ink-muted">
                          {playlist.trackCount} tracks
                        </span>
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            </section>
          ) : null}

          <RecentRail
            title="Jump back in"
            tracks={recentPlays}
            activeTrackId={activeId}
            isPlaying={player.isPlaying}
            onPlay={(_track, index) =>
              engine.setQueue(recentPlays, index, "Recently played")
            }
            action={
              recentPlays.length > 0 ? (
                <span className="flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
                  <Sparkles className="h-3 w-3 text-amber" />
                  history
                </span>
              ) : null
            }
          />

          {recentPlays.length === 0 && playlists.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-ink/[0.12] px-4 py-5 text-center">
              <p className="text-[13px] font-semibold text-ink">
                Your vault is empty — for now
              </p>
              <p className="mt-1 text-[12px] leading-relaxed text-ink-muted">
                Search something above, tap a vibe, or save a track with the heart
                icon. Everything you touch stays private to your account.
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
