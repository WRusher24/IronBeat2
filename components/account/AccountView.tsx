"use client";

import { LogOut, Share, ShieldCheck, Smartphone, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useToast } from "@/components/providers/ToastProvider";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { apiFetch, errorMessage } from "@/lib/api-client";

interface AccountViewProps {
  displayName: string;
  email: string;
  joinedAt: string;
  stats: { playlistCount: number; favoriteCount: number; playCount: number };
}

export function AccountView({
  displayName,
  email,
  joinedAt,
  stats,
}: AccountViewProps) {
  const router = useRouter();
  const toast = useToast();
  const [signingOut, setSigningOut] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  const signOut = async () => {
    setSigningOut(true);
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
      router.replace("/login");
      router.refresh();
    } catch (error) {
      toast(errorMessage(error), "error");
      setSigningOut(false);
    }
  };

  const deleteAccount = async () => {
    if (confirmText.trim().toUpperCase() !== "DELETE") return;

    setDeleting(true);
    try {
      await apiFetch("/api/account", { method: "DELETE" });
      router.replace("/register");
      router.refresh();
    } catch (error) {
      toast(errorMessage(error), "error");
      setDeleting(false);
    }
  };

  const joined = new Date(joinedAt).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  return (
    <div>
      <header className="pt-[calc(env(safe-area-inset-top)_+_20px)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-muted">
          Account
        </p>
        <h1 className="mt-1 font-display text-[32px] leading-[1.04] tracking-[-0.02em] text-ink">
          Your vault
        </h1>
      </header>

      <div className="mt-5 rounded-[26px] bg-ink p-5 text-cream">
        <div className="flex items-center gap-3.5">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-amber text-[20px] font-bold uppercase text-ink">
            {displayName.trim().slice(0, 1) || "I"}
          </span>
          <div className="min-w-0">
            <p className="truncate font-display text-[22px] leading-tight">
              {displayName}
            </p>
            <p className="truncate text-[11.5px] text-cream/55">{email}</p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 divide-x divide-cream/10 rounded-2xl bg-cream/[0.05] py-3">
          <Stat label="Folders" value={stats.playlistCount} />
          <Stat label="Saved" value={stats.favoriteCount} />
          <Stat label="Plays" value={stats.playCount} />
        </div>

        <p className="mt-3 text-[10.5px] text-cream/40">Training with IronBeat since {joined}</p>
      </div>

      <section className="mt-6">
        <div className="mb-2.5 flex items-center gap-1.5">
          <Smartphone className="h-3.5 w-3.5 text-amber" strokeWidth={2.2} />
          <h2 className="label-xs">Install on your iPhone</h2>
        </div>

        <div className="rounded-2xl border border-ink/[0.07] bg-white/70 p-4">
          <ol className="space-y-2.5">
            {[
              "Open IronBeat in Safari (not Chrome — iOS only installs from Safari).",
              "Tap the Share button in the toolbar.",
              "Scroll and choose “Add to Home Screen”, then tap Add.",
              "Launch it from your home screen — fullscreen, no browser chrome.",
            ].map((step, index) => (
              <li key={step} className="flex gap-2.5">
                <span className="mt-[1px] grid h-4 w-4 shrink-0 place-items-center rounded-full bg-ink text-[9px] font-bold text-cream">
                  {index + 1}
                </span>
                <span className="text-[12px] leading-relaxed text-ink-muted">{step}</span>
              </li>
            ))}
          </ol>

          <div className="mt-3 flex items-center gap-1.5 rounded-xl bg-amber/10 px-3 py-2">
            <Share className="h-3.5 w-3.5 shrink-0 text-amber-deep" strokeWidth={2.2} />
            <p className="text-[11px] font-medium text-amber-deep">
              Lock-screen and AirPods controls work once the app is installed.
            </p>
          </div>
        </div>
      </section>

      <section className="mt-6 space-y-2.5">
        <div className="flex items-start gap-2.5 rounded-2xl border border-ink/[0.07] bg-white/60 p-3.5">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-ink-muted" strokeWidth={2} />
          <p className="text-[11.5px] leading-relaxed text-ink-muted">
            Your playlists, saved tracks and search history are isolated to this
            account. Sessions expire after 30 days and can be ended at any time.
          </p>
        </div>

        <Button
          variant="outline"
          fullWidth
          onClick={() => void signOut()}
          disabled={signingOut}
        >
          <LogOut className="h-4 w-4" strokeWidth={2.2} />
          {signingOut ? "Signing out…" : "Sign out"}
        </Button>

        <button
          type="button"
          onClick={() => setDeleteOpen(true)}
          className="flex w-full items-center justify-center gap-1.5 py-2 text-[12px] font-semibold text-[#7f2d20]/80"
        >
          <Trash2 className="h-3.5 w-3.5" strokeWidth={2.2} />
          Delete account
        </button>
      </section>

      <Sheet
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete your account?"
        subtitle="Every folder, saved track and search is permanently erased."
      >
        <div className="space-y-3 pt-1">
          <p className="text-[12.5px] leading-relaxed text-ink-muted">
            This cannot be undone. Type <strong className="text-ink">DELETE</strong> to
            confirm.
          </p>
          <input
            value={confirmText}
            onChange={(event) => setConfirmText(event.target.value)}
            placeholder="DELETE"
            autoCapitalize="characters"
            className="h-[50px] w-full rounded-2xl border border-ink/[0.08] bg-white/80 px-3.5 text-[15px] uppercase tracking-widest outline-none focus:border-[#7f2d20]/50"
          />
          <Button
            variant="danger"
            fullWidth
            size="lg"
            disabled={deleting || confirmText.trim().toUpperCase() !== "DELETE"}
            onClick={() => void deleteAccount()}
          >
            {deleting ? "Deleting…" : "Permanently delete"}
          </Button>
        </div>
      </Sheet>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="px-2 text-center">
      <p className="font-display text-[20px] leading-none text-cream">{value}</p>
      <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.14em] text-cream/40">
        {label}
      </p>
    </div>
  );
}
