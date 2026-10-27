"use client";

import { Loader2, Pause, Play, SkipForward } from "lucide-react";
import { useState } from "react";

import { usePlayerEngine, usePlayerState } from "@/components/providers/PlayerProvider";
import { Artwork } from "@/components/ui/Artwork";
import { cn } from "@/lib/utils";

import { FullPlayer } from "./FullPlayer";

/**
 * Sticky mini player, pinned above the bottom navigation on every page.
 * Tapping the artwork/title expands the full-screen player.
 */
export function MiniPlayer() {
  const state = usePlayerState();
  const engine = usePlayerEngine();
  const [expanded, setExpanded] = useState(false);

  if (!state.hydrated || !state.current) return null;

  const progress =
    state.duration > 0 ? Math.min((state.currentTime / state.duration) * 100, 100) : 0;

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(74px_+_var(--safe-bottom))] z-40 px-4">
        <div className="pointer-events-auto mx-auto max-w-[520px]">
          <div
            className={cn(
              "relative overflow-hidden rounded-[22px] bg-ink text-cream shadow-player transition-opacity",
              expanded && "pointer-events-none opacity-0",
            )}
          >
            <div className="absolute inset-x-0 top-0 h-[2px] bg-cream/10">
              <div
                className="h-full bg-amber-soft transition-[width] duration-300 ease-linear"
                style={{ width: `${progress}%` }}
              />
            </div>

            <div className="flex items-center gap-2.5 py-2 pl-2 pr-2.5">
              <button
                type="button"
                onClick={() => setExpanded(true)}
                className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                aria-label="Open player"
              >
                <Artwork
                  src={state.current.artwork}
                  alt=""
                  size={42}
                  rounded="rounded-[12px]"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold leading-tight tracking-[-0.01em]">
                    {state.current.title}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-cream/55">
                    <span className="truncate">{state.current.artist}</span>
                    {state.isLoading ? (
                      <Loader2 className="h-3 w-3 shrink-0 animate-spin text-amber-soft" />
                    ) : null}
                  </span>
                </span>
              </button>

              <button
                type="button"
                onClick={() => engine.toggle()}
                aria-label={state.isPlaying ? "Pause" : "Play"}
                className={cn(
                  "tap grid h-10 w-10 shrink-0 place-items-center rounded-full bg-amber text-ink",
                  state.needsGesture && !state.isPlaying && "animate-pulse",
                )}
              >
                {state.isPlaying ? (
                  <Pause className="h-[18px] w-[18px] fill-ink" strokeWidth={0} />
                ) : (
                  <Play className="ml-[2px] h-[18px] w-[18px] fill-ink" strokeWidth={0} />
                )}
              </button>

              <button
                type="button"
                onClick={() => engine.next()}
                aria-label="Next track"
                className="tap grid h-9 w-9 shrink-0 place-items-center rounded-full text-cream/70 hover:bg-cream/10"
              >
                <SkipForward className="h-[17px] w-[17px] fill-current" strokeWidth={0} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <FullPlayer open={expanded} onClose={() => setExpanded(false)} />
    </>
  );
}
