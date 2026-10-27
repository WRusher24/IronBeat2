"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[ironbeat]", error);
  }, [error]);

  const missingDb =
    error.message.includes("DATABASE_URL") ||
    error.message.toLowerCase().includes("connection");

  return (
    <div className="flex min-h-[80dvh] flex-col items-center justify-center text-center">
      <span className="label-xs">Something broke</span>

      <h1 className="mt-2 font-display text-[28px] leading-tight text-ink">
        {missingDb ? "Database not connected" : "That didn't load"}
      </h1>

      <p className="mt-2 max-w-[290px] text-[13px] leading-relaxed text-ink-muted">
        {missingDb
          ? "IronBeat can't reach Postgres. Add your Neon DATABASE_URL to .env.local, then run npm run db:push."
          : "The page hit an unexpected error. Retrying usually clears it."}
      </p>

      {error.digest ? (
        <p className="mt-3 rounded-full bg-ink/[0.05] px-3 py-1 text-[10.5px] font-mono text-ink-muted">
          {error.digest}
        </p>
      ) : null}

      <button
        type="button"
        onClick={reset}
        className="mt-6 rounded-full bg-ink px-5 py-2.5 text-[13px] font-semibold text-cream"
      >
        Try again
      </button>
    </div>
  );
}
