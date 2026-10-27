import type { Metadata } from "next";

import { AuthForm } from "@/components/auth/AuthForm";

export const metadata: Metadata = {
  title: "Sign in",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="flex min-h-dvh flex-col justify-center py-10">
      <div className="mb-8">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-[9px] bg-ink">
            <span className="flex h-3.5 items-end gap-[2px]">
              <span className="h-full w-[2.5px] rounded-full bg-amber" />
              <span className="h-2/3 w-[2.5px] rounded-full bg-amber/70" />
              <span className="h-1/3 w-[2.5px] rounded-full bg-amber/45" />
            </span>
          </span>
          <span className="text-[11px] font-bold uppercase tracking-[0.28em] text-ink">
            IronBeat
          </span>
        </div>

        <h1 className="mt-6 font-display text-[38px] leading-[1.02] tracking-[-0.02em] text-ink">
          Welcome back
          <br />
          to the floor.
        </h1>
        <p className="mt-2.5 max-w-[300px] text-[13.5px] leading-relaxed text-ink-muted">
          Your playlists, saved tracks and search history are exactly where you
          left them.
        </p>
      </div>

      <AuthForm mode="login" nextPath={params.next} />
    </div>
  );
}
