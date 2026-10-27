import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Offline",
};

export default function OfflinePage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center text-center">
      <span className="grid h-14 w-14 place-items-center rounded-[18px] bg-ink">
        <span className="flex h-7 items-end gap-1">
          <span className="h-1/3 w-[3px] rounded-full bg-amber/50" />
          <span className="h-2/3 w-[3px] rounded-full bg-amber/70" />
          <span className="h-full w-[3px] rounded-full bg-amber" />
        </span>
      </span>

      <h1 className="mt-6 font-display text-[30px] leading-tight text-ink">
        Signal dropped
      </h1>
      <p className="mt-2 max-w-[260px] text-[13px] leading-relaxed text-ink-muted">
        IronBeat needs a connection to stream. Your saved folders and queue are
        still here — reconnect and pick up where you left off.
      </p>

      <Link
        href="/"
        className="mt-6 rounded-full bg-ink px-5 py-2.5 text-[13px] font-semibold text-cream"
      >
        Try again
      </Link>
    </div>
  );
}
