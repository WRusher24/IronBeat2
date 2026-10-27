import type { Metadata } from "next";

import { AuthForm } from "@/components/auth/AuthForm";

export const metadata: Metadata = {
  title: "Create account",
};

export default function RegisterPage() {
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
          Your vault.
          <br />
          Your sound.
        </h1>
        <p className="mt-2.5 max-w-[310px] text-[13.5px] leading-relaxed text-ink-muted">
          One account, one private container. No approval queue — you&apos;re in
          the moment you hit create.
        </p>
      </div>

      <AuthForm mode="register" />
    </div>
  );
}
