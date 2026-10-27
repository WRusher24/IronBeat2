"use client";

import { Play } from "lucide-react";
import type { ReactNode } from "react";

import { Artwork } from "@/components/ui/Artwork";
import type { Track } from "@/lib/tracks";
import { cn } from "@/lib/utils";

interface RecentRailProps {
  title: string;
  tracks: Track[];
  activeTrackId: string | null;
  isPlaying: boolean;
  onPlay: (track: Track, index: number) => void;
  action?: ReactNode;
}

/** Horizontally scrolling "jump back in" rail. */
export function RecentRail({
  title,
  tracks,
  activeTrackId,
  isPlaying,
  onPlay,
  action,
}: RecentRailProps) {
  if (tracks.length === 0) return null;

  return (
    <section>
      <div className="mb-2.5 flex items-baseline justify-between">
        <h2 className="section-title">{title}</h2>
        {action}
      </div>

      <div className="-mx-5 overflow-x-auto px-5 pb-1 no-scrollbar">
        <div className="flex w-max gap-3">
          {tracks.map((track, index) => {
            const active = activeTrackId === track.id;

            return (
              <button
                key={`${track.id}-${index}`}
                type="button"
                onClick={() => onPlay(track, index)}
                className="w-[116px] shrink-0 text-left transition-transform active:scale-[0.97]"
              >
                <div className="relative">
                  <Artwork
                    src={track.artwork}
                    alt=""
                    size={116}
                    rounded="rounded-[16px]"
                    className={cn("shadow-chip", active && "ring-2 ring-amber")}
                  />
                  <span
                    className={cn(
                      "absolute bottom-1.5 right-1.5 grid h-7 w-7 place-items-center rounded-full backdrop-blur",
                      active && isPlaying
                        ? "bg-amber text-ink"
                        : "bg-ink/55 text-cream",
                    )}
                  >
                    <Play className="ml-[1px] h-3 w-3 fill-current" strokeWidth={0} />
                  </span>
                </div>
                <p
                  className={cn(
                    "mt-2 truncate text-[12px] font-semibold leading-tight",
                    active ? "text-amber-deep" : "text-ink",
                  )}
                >
                  {track.title}
                </p>
                <p className="mt-0.5 truncate text-[10.5px] text-ink-muted">
                  {track.artist}
                </p>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
