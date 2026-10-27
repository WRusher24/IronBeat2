"use client";

import { ArrowUpRight, Loader2, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useToast } from "@/components/providers/ToastProvider";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { apiFetch, errorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";

export interface PlaylistCard {
  id: string;
  name: string;
  description: string | null;
  accent: string;
  trackCount: number;
}

const ACCENTS: Array<{ key: string; label: string; className: string }> = [
  { key: "amber", label: "Amber", className: "bg-amber" },
  { key: "ember", label: "Ember", className: "bg-[#B4552F]" },
  { key: "moss", label: "Moss", className: "bg-[#7E7A5A]" },
  { key: "ocean", label: "Ocean", className: "bg-[#6F7C80]" },
  { key: "violet", label: "Violet", className: "bg-[#7A6E86]" },
  { key: "sand", label: "Sand", className: "bg-[#C9A97A]" },
];

function accentClasses(accent: string): string {
  switch (accent) {
    case "ember":
      return "bg-[#B4552F]/15 text-[#B4552F]";
    case "moss":
      return "bg-[#7E7A5A]/15 text-[#6C6849]";
    case "ocean":
      return "bg-[#6F7C80]/15 text-[#5A676B]";
    case "violet":
      return "bg-[#7A6E86]/15 text-[#6B5F77]";
    case "sand":
      return "bg-[#C9A97A]/20 text-[#9A7A4C]";
    default:
      return "bg-amber/15 text-amber-deep";
  }
}

export function PlaylistsView({ initialPlaylists }: { initialPlaylists: PlaylistCard[] }) {
  const [playlists, setPlaylists] = useState(initialPlaylists);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [accent, setAccent] = useState("amber");
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const router = useRouter();

  const create = async () => {
    const trimmed = name.trim();
    if (!trimmed || busy) return;

    setBusy(true);
    try {
      const data = await apiFetch<{ playlist: PlaylistCard }>("/api/playlists", {
        method: "POST",
        body: JSON.stringify({
          name: trimmed,
          description: description.trim() || null,
          accent,
        }),
      });

      setPlaylists((current) => [data.playlist, ...current]);
      setOpen(false);
      setName("");
      setDescription("");
      setAccent("amber");
      toast("Folder created", "success");
      router.refresh();
    } catch (error) {
      toast(errorMessage(error), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <header className="flex items-start justify-between gap-4 pt-[calc(env(safe-area-inset-top)_+_20px)]">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-muted">
            Playlists
          </p>
          <h1 className="mt-1 font-display text-[32px] leading-[1.04] tracking-[-0.02em] text-ink">
            Training folders
          </h1>
        </div>

        <button
          type="button"
          onClick={() => setOpen(true)}
          className="tap mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ink text-cream"
          aria-label="New folder"
        >
          <Plus className="h-5 w-5" strokeWidth={2.3} />
        </button>
      </header>

      <p className="mt-2 text-[12.5px] leading-relaxed text-ink-muted">
        Push days, PR attempts, cool-downs — build a folder for every phase of the
        session. Only you can see them.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3">
        {playlists.map((playlist) => (
          <Link
            key={playlist.id}
            href={`/playlists/${playlist.id}`}
            className="tap group relative flex min-h-[142px] flex-col justify-between rounded-[22px] border border-ink/[0.07] bg-white/70 p-3.5"
          >
            <div className="flex items-start justify-between">
              <span
                className={cn(
                  "grid h-9 w-9 place-items-center rounded-xl",
                  accentClasses(playlist.accent),
                )}
              >
                <span className="flex h-3.5 items-end gap-[2px]">
                  <span className="h-1/2 w-[2.5px] rounded-full bg-current" />
                  <span className="h-full w-[2.5px] rounded-full bg-current" />
                  <span className="h-2/3 w-[2.5px] rounded-full bg-current" />
                </span>
              </span>
              <ArrowUpRight className="h-4 w-4 text-ink-muted/60 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </div>

            <div>
              <p className="line-clamp-2 text-[14px] font-semibold leading-tight tracking-[-0.01em] text-ink">
                {playlist.name}
              </p>
              <p className="mt-1 text-[10.5px] text-ink-muted">
                {playlist.trackCount} {playlist.trackCount === 1 ? "track" : "tracks"}
              </p>
            </div>
          </Link>
        ))}

        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex min-h-[142px] flex-col items-center justify-center gap-2 rounded-[22px] border border-dashed border-ink/15 text-ink-muted transition-colors hover:border-amber/50 hover:text-ink"
        >
          <span className="grid h-9 w-9 place-items-center rounded-full bg-ink/[0.05]">
            <Plus className="h-4 w-4" strokeWidth={2.3} />
          </span>
          <span className="text-[12px] font-semibold">New folder</span>
        </button>
      </div>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="New training folder"
        subtitle="Name it after the session, not the song."
      >
        <div className="space-y-4 pt-1">
          <label className="block">
            <span className="label-xs mb-1.5 block">Name</span>
            <input
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void create();
              }}
              placeholder="Push day — heavy"
              maxLength={60}
              className="h-[50px] w-full rounded-2xl border border-ink/[0.08] bg-white/80 px-3.5 text-[15px] outline-none placeholder:text-ink-muted/60 focus:border-amber/60"
            />
          </label>

          <label className="block">
            <span className="label-xs mb-1.5 block">Note (optional)</span>
            <input
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Top sets, 4–6 reps"
              maxLength={200}
              className="h-[50px] w-full rounded-2xl border border-ink/[0.08] bg-white/80 px-3.5 text-[15px] outline-none placeholder:text-ink-muted/60 focus:border-amber/60"
            />
          </label>

          <div>
            <span className="label-xs mb-2 block">Accent</span>
            <div className="flex gap-2.5">
              {ACCENTS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setAccent(option.key)}
                  aria-label={option.label}
                  aria-pressed={accent === option.key}
                  className={cn(
                    "h-8 w-8 rounded-full ring-offset-2 ring-offset-cream transition-all",
                    option.className,
                    accent === option.key
                      ? "ring-2 ring-ink/60"
                      : "opacity-60 hover:opacity-100",
                  )}
                />
              ))}
            </div>
          </div>

          <Button
            fullWidth
            size="lg"
            onClick={() => void create()}
            disabled={busy || name.trim().length === 0}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {busy ? "Creating…" : "Create folder"}
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
