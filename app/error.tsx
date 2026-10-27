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

  const raw = error.message.toLowerCase();
  const missingSchema =
    /relation .* does not exist|column .* does not exist/.test(raw);
  const missingDb =
    !missingSchema &&
    (raw.includes("database_url") ||
      /econnrefused|enotfound|fetch failed|connection terminated|timeout expired/.test(
        raw,
      ));

  return (
    <div className="flex min-h-[80dvh] flex-col items-center justify-center text-center">
      <span className="label-xs">Something broke</span>

      <h1 className="mt-2 font-display text-[28px] leading-tight text-ink">
        {missingSchema
          ? "Database not migrated"
          : missingDb
            ? "Database not connected"
            : "That didn't load"}
      </h1>

      <p className="mt-2 max-w-[290px] text-[13px] leading-relaxed text-ink-muted">
        {missingSchema
          ? "The database is reachable but empty. Run npm run db:migrate against it, then redeploy — or check /api/health for the exact status."
          : missingDb
            ? "IronBeat can't reach Postgres. Add your DATABASE_URL to the environment, then check /api/health."
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
