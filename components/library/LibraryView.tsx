"use client";

import { Clock3, Heart, Play, Shuffle } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { usePlayerEngine, usePlayerState } from "@/components/providers/PlayerProvider";
import { TrackRow } from "@/components/player/TrackRow";
import { Button } from "@/components/ui/Button";
import type { Track } from "@/lib/tracks";
import { cn } from "@/lib/utils";

type Tab = "saved" | "recent";

export function LibraryView({
  favorites,
  recent,
}: {
  favorites: Track[];
  recent: Track[];
}) {
  const engine = usePlayerEngine();
  const player = usePlayerState();
  const [tab, setTab] = useState<Tab>("saved");

  const tracks = tab === "saved" ? favorites : recent;
  const label = tab === "saved" ? "Saved tracks" : "Recently played";

  return (
    <div>
      <header className="pt-[calc(env(safe-area-inset-top)_+_20px)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-muted">
          Your vault
        </p>
        <h1 className="mt-1 font-display text-[32px] leading-[1.04] tracking-[-0.02em] text-ink">
          Saved &amp; played
        </h1>
      </header>

      <div className="mt-4 flex rounded-full bg-ink/[0.05] p-1">
        <button
          type="button"
          onClick={() => setTab("saved")}
          className={cn(
            "flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full text-[12.5px] font-semibold transition-colors",
            tab === "saved" ? "bg-white text-ink shadow-chip" : "text-ink-muted",
          )}
        >
          <Heart
            className={cn("h-3.5 w-3.5", tab === "saved" && "fill-amber text-amber")}
            strokeWidth={2.2}
          />
          Saved
          <span className="text-[10px] tabular-nums text-ink-muted">{favorites.length}</span>
        </button>
        <button
          type="button"
          onClick={() => setTab("recent")}
          className={cn(
            "flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full text-[12.5px] font-semibold transition-colors",
            tab === "recent" ? "bg-white text-ink shadow-chip" : "text-ink-muted",
          )}
        >
          <Clock3 className="h-3.5 w-3.5" strokeWidth={2.2} />
          Recent
          <span className="text-[10px] tabular-nums text-ink-muted">{recent.length}</span>
        </button>
      </div>

      {tracks.length > 0 ? (
        <div className="mt-4 flex items-center gap-2.5">
          <Button
            size="md"
            onClick={() => engine.setQueue(tracks, 0, label)}
            className="flex-1"
          >
            <Play className="h-3.5 w-3.5 fill-ink" strokeWidth={0} />
            Play all
          </Button>
          <button
            type="button"
            onClick={() => engine.setQueue(tracks, 0, label, { shuffle: true })}
            aria-label="Shuffle"
            className="tap grid h-11 w-11 shrink-0 place-items-center rounded-full border border-ink/15 text-ink"
          >
            <Shuffle className="h-4 w-4" strokeWidth={2.2} />
          </button>
        </div>
      ) : null}

      <div className="mt-5">
        {tracks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-ink/15 px-4 py-8 text-center">
            <p className="text-[13.5px] font-semibold text-ink">
              {tab === "saved" ? "Nothing saved yet" : "No listening history yet"}
            </p>
            <p className="mx-auto mt-1 max-w-[250px] text-[12px] leading-relaxed text-ink-muted">
              {tab === "saved"
                ? "Tap the heart on any track and it lands here — available instantly next session."
                : "Play something and it'll show up here, ready to relaunch in one tap."}
            </p>
            <Link
              href="/search"
              className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-[12px] font-semibold text-cream"
            >
              Search music
            </Link>
          </div>
        ) : (
          <div className="space-y-0.5">
            {tracks.map((track, index) => (
              <TrackRow
                key={track.id}
                track={track}
                index={index}
                isActive={player.current?.id === track.id}
                isPlaying={player.isPlaying}
                onPlay={() => engine.setQueue(tracks, index, label)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
