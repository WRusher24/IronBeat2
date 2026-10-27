"use client";

import { ArrowDown, ArrowUp, MoreVertical, Trash2 } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";

import { usePlayerState } from "@/components/providers/PlayerProvider";
import { Artwork } from "@/components/ui/Artwork";
import { Equalizer } from "@/components/ui/Equalizer";
import { Sheet } from "@/components/ui/Sheet";
import type { Track } from "@/lib/tracks";
import { formatDuration } from "@/lib/tracks";
import { cn } from "@/lib/utils";

interface PlaylistTrackRowProps {
  track: Track;
  index: number;
  isPlaying: boolean;
  onPlay: () => void;
  onMove: (direction: "up" | "down") => void;
  onRemove: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}

export function PlaylistTrackRow({
  track,
  index,
  isPlaying,
  onPlay,
  onMove,
  onRemove,
  canMoveUp,
  canMoveDown,
}: PlaylistTrackRowProps) {
  const [open, setOpen] = useState(false);
  const player = usePlayerState();
  const active = player.current?.id === track.id;

  return (
    <>
      <div
        className={cn(
          "flex items-center gap-3 rounded-2xl px-2 py-2",
          active ? "bg-ink/[0.055]" : "hover:bg-ink/[0.035]",
        )}
      >
        <button
          type="button"
          onClick={onPlay}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
          aria-label={`Play ${track.title}`}
        >
          <span className="w-4 shrink-0 text-center text-[11px] font-semibold tabular-nums text-ink-muted">
            {active && isPlaying ? (
              <Equalizer className="mx-auto text-amber" />
            ) : (
              index + 1
            )}
          </span>

          <Artwork src={track.artwork} alt="" size={46} rounded="rounded-[12px]" />

          <span className="min-w-0 flex-1">
            <span
              className={cn(
                "block truncate text-[14px] font-semibold leading-tight",
                active ? "text-amber-deep" : "text-ink",
              )}
            >
              {track.title}
            </span>
            <span className="mt-0.5 block truncate text-[11.5px] text-ink-muted">
              {track.artist}
              <span className="mx-1.5 text-ink/20">·</span>
              {formatDuration(track.duration)}
            </span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Track actions"
          className="tap grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-muted hover:bg-ink/[0.06]"
        >
          <MoreVertical className="h-[17px] w-[17px]" strokeWidth={2.1} />
        </button>
      </div>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={track.title}
        subtitle={track.artist}
      >
        <div className="space-y-1.5 pt-1">
          <ActionRow
            icon={<ArrowUp className="h-4 w-4" strokeWidth={2.2} />}
            label="Move up"
            disabled={!canMoveUp}
            onClick={() => {
              onMove("up");
              setOpen(false);
            }}
          />
          <ActionRow
            icon={<ArrowDown className="h-4 w-4" strokeWidth={2.2} />}
            label="Move down"
            disabled={!canMoveDown}
            onClick={() => {
              onMove("down");
              setOpen(false);
            }}
          />
          <ActionRow
            icon={<Trash2 className="h-4 w-4" strokeWidth={2.2} />}
            label="Remove from folder"
            destructive
            onClick={() => {
              onRemove();
              setOpen(false);
            }}
          />
        </div>
      </Sheet>
    </>
  );
}

function ActionRow({
  icon,
  label,
  onClick,
  disabled,
  destructive,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex w-full items-center gap-3 rounded-2xl bg-white/70 px-4 py-3.5 text-left text-[14px] font-medium transition-colors",
        destructive ? "text-[#7f2d20] hover:bg-[#7f2d20]/[0.06]" : "text-ink hover:bg-white",
        disabled && "pointer-events-none opacity-35",
      )}
    >
      {icon}
      {label}
    </button>
  );
}
