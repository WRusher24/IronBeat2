"use client";

import { Loader2 } from "lucide-react";

import { EnergyMeter } from "@/components/ui/Equalizer";
import type { Mood } from "@/lib/moods";
import { cn } from "@/lib/utils";

interface MoodDeckProps {
  moods: Mood[];
  loadingSlug: string | null;
  onLaunch: (mood: Mood) => void;
}

/**
 * The Vibe Deck. Twelve curated training moods, each of which expands into a
 * live playlist from every configured audio source on tap.
 */
export function MoodDeck({ moods, loadingSlug, onLaunch }: MoodDeckProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {moods.map((mood) => {
        const loading = loadingSlug === mood.slug;

        return (
          <button
            key={mood.slug}
            type="button"
            onClick={() => onLaunch(mood)}
            disabled={loadingSlug !== null}
            aria-label={`Play the ${mood.title} vibe`}
            className={cn(
              "group relative flex min-h-[150px] flex-col justify-between overflow-hidden rounded-[24px] bg-ink p-4 text-left",
              "transition-transform duration-200 active:scale-[0.975]",
              "disabled:opacity-90",
            )}
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0"
              style={{
                background: `radial-gradient(125% 95% at 12% -8%, ${mood.glow}5c 0%, transparent 62%)`,
              }}
            />
            <span
              aria-hidden="true"
              className="grain pointer-events-none absolute inset-0 opacity-[0.05] mix-blend-screen"
            />

            <div className="relative flex items-start justify-between">
              <span className="text-[23px] leading-none drop-shadow-sm">
                {mood.emoji}
              </span>
              <EnergyMeter energy={mood.energy} />
            </div>

            <div className="relative mt-4">
              <p className="font-display text-[17.5px] leading-[1.08] tracking-[-0.01em] text-cream">
                {mood.title}
              </p>
              <p className="mt-1.5 line-clamp-2 text-[10.5px] leading-[1.35] text-cream/45">
                {mood.blurb}
              </p>
              <p className="mt-2.5 text-[8.5px] font-bold uppercase tracking-[0.16em] text-amber-soft/85">
                {mood.meta}
              </p>
            </div>

            {loading ? (
              <span className="absolute inset-0 grid place-items-center rounded-[24px] bg-ink/70 backdrop-blur-[2px]">
                <Loader2 className="h-5 w-5 animate-spin text-amber-soft" />
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
