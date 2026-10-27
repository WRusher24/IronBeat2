"use client";

import { Heart, Plus } from "lucide-react";
import { useState } from "react";

import { useFavorites } from "@/components/providers/FavoritesProvider";
import { AddToPlaylistSheet } from "@/components/player/AddToPlaylistSheet";
import { Artwork } from "@/components/ui/Artwork";
import { Equalizer } from "@/components/ui/Equalizer";
import type { Track } from "@/lib/tracks";
import { formatDuration } from "@/lib/tracks";
import { cn } from "@/lib/utils";

interface TrackRowProps {
  track: Track;
  index?: number;
  isActive?: boolean;
  isPlaying?: boolean;
  onPlay: () => void;
  showIndex?: boolean;
  className?: string;
}

export function TrackRow({
  track,
  index,
  isActive = false,
  isPlaying = false,
  onPlay,
  showIndex = false,
  className,
}: TrackRowProps) {
  const { isFavorite, toggle } = useFavorites();
  const [addOpen, setAddOpen] = useState(false);
  const favorite = isFavorite(track.id);

  return (
    <>
      <div
        className={cn(
          "group flex items-center gap-3 rounded-2xl px-2 py-2 transition-colors",
          isActive ? "bg-ink/[0.055]" : "hover:bg-ink/[0.035]",
          className,
        )}
      >
        <button
          type="button"
          onClick={onPlay}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
          aria-label={`Play ${track.title} by ${track.artist}`}
        >
          {showIndex && typeof index === "number" ? (
            <span className="w-4 shrink-0 text-center text-[11px] font-semibold tabular-nums text-ink-muted">
              {isActive && isPlaying ? (
                <Equalizer className="mx-auto text-amber" />
              ) : (
                index + 1
              )}
            </span>
          ) : null}

          <div className="relative">
            <Artwork
              src={track.artwork}
              alt=""
              size={48}
              rounded="rounded-[13px]"
            />
            {isActive ? (
              <span className="absolute -bottom-0.5 -right-0.5 grid h-4 w-4 place-items-center rounded-full bg-ink text-amber">
                {isPlaying ? (
                  <Equalizer className="scale-[0.55] text-amber" />
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-amber" />
                )}
              </span>
            ) : null}
          </div>

          <div className="min-w-0 flex-1">
            <p
              className={cn(
                "truncate text-[14.5px] font-semibold leading-tight tracking-[-0.01em]",
                isActive ? "text-amber-deep" : "text-ink",
              )}
            >
              {track.title}
            </p>
            <p className="mt-0.5 truncate text-[12px] text-ink-muted">
              {track.artist}
              <span className="mx-1.5 text-ink/20">·</span>
              <span className="tabular-nums">{formatDuration(track.duration)}</span>
            </p>
          </div>
        </button>

        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={() => void toggle(track)}
            aria-label={favorite ? "Remove from saved" : "Save track"}
            aria-pressed={favorite}
            className="tap grid h-9 w-9 place-items-center rounded-full text-ink-muted hover:bg-ink/[0.06]"
          >
            <Heart
              className={cn("h-[17px] w-[17px]", favorite && "fill-amber text-amber")}
              strokeWidth={2}
            />
          </button>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            aria-label="Add to a playlist"
            className="tap grid h-9 w-9 place-items-center rounded-full text-ink-muted hover:bg-ink/[0.06]"
          >
            <Plus className="h-[18px] w-[18px]" strokeWidth={2.1} />
          </button>
        </div>
      </div>

      <AddToPlaylistSheet
        track={track}
        open={addOpen}
        onClose={() => setAddOpen(false)}
      />
    </>
  );
}
