"use client";

import { Loader2, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";

interface SmartShuffleCardProps {
  onLaunch: () => void;
  loading: boolean;
  basis: string[] | null;
  coldStart: boolean;
}

export function SmartShuffleCard({
  onLaunch,
  loading,
  basis,
  coldStart,
}: SmartShuffleCardProps) {
  return (
    <div className="relative overflow-hidden rounded-[28px] bg-ink px-5 pb-5 pt-4 text-cream shadow-lift">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 120% at 100% 0%, rgba(198,125,59,0.38) 0%, rgba(28,28,30,0) 58%)",
        }}
      />
      <span
        aria-hidden="true"
        className="grain pointer-events-none absolute inset-0 opacity-[0.06] mix-blend-screen"
      />

      <div className="relative">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-3 w-3 text-amber-soft" strokeWidth={2.4} />
          <span className="text-[9.5px] font-bold uppercase tracking-[0.18em] text-amber-soft">
            {coldStart ? "Your starter mix" : "Built from your training history"}
          </span>
        </div>

        <h2 className="mt-2 font-display text-[27px] leading-[1.05] tracking-[-0.02em]">
          Smart Shuffle
        </h2>
        <p className="mt-1.5 max-w-[85%] text-[12px] leading-[1.45] text-cream/55">
          A one-off mix from the genres you actually reach for — reshuffled every
          time, never the same session twice.
        </p>

        {basis && basis.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {basis.slice(0, 4).map((seed) => (
              <span
                key={seed}
                className="rounded-full bg-cream/[0.08] px-2 py-1 text-[10px] font-medium text-cream/65"
              >
                {seed}
              </span>
            ))}
          </div>
        ) : null}

        <button
          type="button"
          onClick={onLaunch}
          disabled={loading}
          className={cn(
            "mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-amber text-[14px] font-semibold text-ink",
            "transition-transform active:scale-[0.985] disabled:opacity-70",
          )}
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Building your mix…
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" strokeWidth={2.4} />
              Start the mix
            </>
          )}
        </button>
      </div>
    </div>
  );
}
