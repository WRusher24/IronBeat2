"use client";

import {
  ChevronDown,
  ExternalLink,
  ListMusic,
  Loader2,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
} from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { usePlayerEngine, usePlayerState } from "@/components/providers/PlayerProvider";
import { Artwork } from "@/components/ui/Artwork";
import { Equalizer } from "@/components/ui/Equalizer";
import { formatClock } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function FullPlayer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const state = usePlayerState();
  const engine = usePlayerEngine();
  const [mounted, setMounted] = useState(false);
  const [scrubValue, setScrubValue] = useState<number | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = original;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!mounted || !open || !state.current) return null;

  const duration = state.duration || state.current.duration || 0;
  const displayTime = scrubValue ?? state.currentTime;
  const upNext = state.queue.slice(state.index + 1, state.index + 8);

  return createPortal(
    <div className="fixed inset-0 z-[95] flex flex-col bg-cream">
      <div className="mx-auto flex h-full w-full max-w-[520px] flex-col px-5">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 pt-[calc(env(safe-area-inset-top)_+_14px)]">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close player"
            className="tap grid h-10 w-10 place-items-center rounded-full bg-ink/[0.06] text-ink"
          >
            <ChevronDown className="h-5 w-5" strokeWidth={2.2} />
          </button>

          <div className="min-w-0 flex-1 px-3 text-center">
            <p className="label-xs">Now playing</p>
            <p className="truncate text-[12px] font-medium text-ink-muted">
              {state.contextLabel || "IronBeat"}
            </p>
          </div>

          {state.current.externalUrl ? (
            <a
              href={state.current.externalUrl}
              target="_blank"
              rel="noreferrer noopener"
              aria-label="Open source"
              className="tap grid h-10 w-10 place-items-center rounded-full bg-ink/[0.06] text-ink"
            >
              <ExternalLink className="h-[18px] w-[18px]" strokeWidth={2} />
            </a>
          ) : (
            <span className="h-10 w-10" />
          )}
        </div>

        {/* Artwork */}
        <div className="relative mt-3 flex shrink-0 items-center justify-center">
          <div className="relative h-[min(78vw,33vh)] w-[min(78vw,33vh)]">
            <div className="absolute inset-x-6 -bottom-3 h-8 rounded-full bg-ink/20 blur-2xl" />
            <Artwork
              src={state.current.artwork}
              alt={state.current.title}
              size={300}
              rounded="rounded-[28px]"
              className="!h-full !w-full shadow-lift"
            />

            {state.needsGesture && !state.isPlaying ? (
              <button
                type="button"
                onClick={() => void engine.play()}
                className="absolute inset-0 grid place-items-center rounded-[28px] bg-ink/45 backdrop-blur-[2px]"
              >
                <span className="flex items-center gap-2 rounded-full bg-amber px-5 py-3 text-[14px] font-semibold text-ink">
                  <Play className="h-4 w-4 fill-ink" strokeWidth={0} />
                  Tap to start
                </span>
              </button>
            ) : null}
          </div>
        </div>

        {/* Meta */}
        <div className="mt-5 flex shrink-0 items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="truncate font-display text-[25px] leading-tight text-ink">
              {state.current.title}
            </h1>
            <p className="mt-1 truncate text-[13px] text-ink-muted">
              {state.current.artist}
            </p>
          </div>
          <span className="mt-1 shrink-0 rounded-full bg-ink/[0.06] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-ink-muted">
            {state.current.provider}
          </span>
        </div>

        {/* Scrubber */}
        <div className="mt-4 shrink-0">
          <input
            type="range"
            min={0}
            max={Math.max(duration, 1)}
            step={0.5}
            value={Math.min(displayTime, Math.max(duration, 1))}
            onChange={(event) => setScrubValue(Number(event.target.value))}
            onPointerUp={() => {
              if (scrubValue !== null) engine.seek(scrubValue);
              setScrubValue(null);
            }}
            onKeyUp={() => {
              if (scrubValue !== null) engine.seek(scrubValue);
              setScrubValue(null);
            }}
            aria-label="Seek"
            className="scrubber scrubber-light"
          />
          <div className="mt-1 flex justify-between text-[11px] font-medium tabular-nums text-ink-muted">
            <span>{formatClock(displayTime)}</span>
            <span>{duration > 0 ? formatClock(duration) : "--:--"}</span>
          </div>
        </div>

        {/* Transport */}
        <div className="mt-2 flex shrink-0 items-center justify-between">
          <button
            type="button"
            onClick={engine.toggleShuffle}
            aria-label="Shuffle"
            aria-pressed={state.shuffle}
            className={cn(
              "tap grid h-11 w-11 place-items-center rounded-full",
              state.shuffle ? "bg-amber/15 text-amber-deep" : "text-ink-muted",
            )}
          >
            <Shuffle className="h-[18px] w-[18px]" strokeWidth={2.2} />
          </button>

          <button
            type="button"
            onClick={engine.previous}
            aria-label="Previous track"
            className="tap grid h-12 w-12 place-items-center rounded-full text-ink"
          >
            <SkipBack className="h-6 w-6 fill-current" strokeWidth={0} />
          </button>

          <button
            type="button"
            onClick={engine.toggle}
            aria-label={state.isPlaying ? "Pause" : "Play"}
            className="tap grid h-[64px] w-[64px] place-items-center rounded-full bg-ink text-cream shadow-lift"
          >
            {state.isLoading ? (
              <Loader2 className="h-6 w-6 animate-spin text-amber-soft" />
            ) : state.isPlaying ? (
              <Pause className="h-7 w-7 fill-cream" strokeWidth={0} />
            ) : (
              <Play className="ml-1 h-7 w-7 fill-cream" strokeWidth={0} />
            )}
          </button>

          <button
            type="button"
            onClick={() => engine.next()}
            aria-label="Next track"
            className="tap grid h-12 w-12 place-items-center rounded-full text-ink"
          >
            <SkipForward className="h-6 w-6 fill-current" strokeWidth={0} />
          </button>

          <button
            type="button"
            onClick={engine.cycleRepeat}
            aria-label={`Repeat: ${state.repeat}`}
            className={cn(
              "tap relative grid h-11 w-11 place-items-center rounded-full",
              state.repeat !== "off" ? "bg-amber/15 text-amber-deep" : "text-ink-muted",
            )}
          >
            {state.repeat === "one" ? (
              <Repeat1 className="h-[18px] w-[18px]" strokeWidth={2.2} />
            ) : (
              <Repeat className="h-[18px] w-[18px]" strokeWidth={2.2} />
            )}
          </button>
        </div>

        {/* Up next */}
        <div className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden pb-[calc(env(safe-area-inset-bottom)_+_14px)]">
          <div className="mb-2 flex shrink-0 items-center justify-between">
            <p className="label-xs flex items-center gap-1.5">
              <ListMusic className="h-3 w-3" strokeWidth={2.4} />
              Up next · {Math.max(state.queue.length - state.index - 1, 0)}
            </p>
            {state.shuffle ? (
              <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-deep">
                Shuffled
              </span>
            ) : null}
          </div>

          <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto overscroll-contain">
            {upNext.length === 0 ? (
              <p className="py-2 text-[12.5px] text-ink-muted">
                Nothing queued — search something new or launch a mood.
              </p>
            ) : (
              upNext.map((track, offset) => (
                <button
                  key={`${track.id}-${offset}`}
                  type="button"
                  onClick={() => engine.jumpTo(state.index + 1 + offset)}
                  className="flex w-full items-center gap-2.5 rounded-xl px-1 py-1.5 text-left hover:bg-ink/[0.04]"
                >
                  <Artwork src={track.artwork} alt="" size={32} rounded="rounded-lg" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-medium text-ink">
                      {track.title}
                    </span>
                    <span className="block truncate text-[10.5px] text-ink-muted">
                      {track.artist}
                    </span>
                  </span>
                  {track.isPreview ? (
                    <span className="text-[9px] font-bold uppercase tracking-wider text-ink-muted">
                      30s
                    </span>
                  ) : null}
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
