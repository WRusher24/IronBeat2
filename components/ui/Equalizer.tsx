import { cn } from "@/lib/utils";

/** Three-bar "now playing" indicator. */
export function Equalizer({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("flex h-3.5 items-end gap-[2px]", className)}
    >
      <span className="w-[2px] origin-bottom animate-eq-1 rounded-full bg-current" style={{ height: "100%" }} />
      <span className="w-[2px] origin-bottom animate-eq-2 rounded-full bg-current" style={{ height: "100%" }} />
      <span className="w-[2px] origin-bottom animate-eq-3 rounded-full bg-current" style={{ height: "100%" }} />
    </span>
  );
}

export function EnergyMeter({
  energy,
  className,
}: {
  energy: number;
  className?: string;
}) {
  return (
    <span className={cn("flex items-center gap-[3px]", className)} aria-hidden="true">
      {[1, 2, 3, 4, 5].map((step) => (
        <span
          key={step}
          className={cn(
            "h-[3px] w-2 rounded-full",
            step <= energy ? "bg-amber-soft" : "bg-cream/20",
          )}
        />
      ))}
    </span>
  );
}
