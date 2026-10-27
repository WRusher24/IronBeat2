"use client";

import {
  ArrowLeft,
  Loader2,
  Play,
  Search,
  Settings2,
  Shuffle,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { PlaylistTrackRow } from "@/components/playlists/PlaylistTrackRow";
import { usePlayerEngine, usePlayerState } from "@/components/providers/PlayerProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { apiFetch, errorMessage } from "@/lib/api-client";
import type { Track } from "@/lib/tracks";
import { cn } from "@/lib/utils";

interface PlaylistData {
  id: string;
  name: string;
  description: string | null;
  accent: string;
  tracks: Track[];
}

const ACCENTS = ["amber", "ember", "moss", "ocean", "violet", "sand"] as const;

export function PlaylistDetailView({ playlist }: { playlist: PlaylistData }) {
  const engine = usePlayerEngine();
  const player = usePlayerState();
  const toast = useToast();
  const router = useRouter();

  const [tracks, setTracks] = useState<Track[]>(playlist.tracks);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [name, setName] = useState(playlist.name);
  const [description, setDescription] = useState(playlist.description ?? "");
  const [accent, setAccent] = useState(playlist.accent);
  const [busy, setBusy] = useState(false);

  const totalMinutes = useMemo(() => {
    const seconds = tracks.reduce((sum, track) => sum + (track.duration ?? 0), 0);
    if (seconds === 0) return null;
    return Math.max(1, Math.round(seconds / 60));
  }, [tracks]);

  const playAll = (shuffle = false) => {
    if (tracks.length === 0) {
      toast("Add a track first", "error");
      return;
    }
    engine.setQueue(tracks, 0, playlist.name, { shuffle });
  };

  const removeTrack = async (trackId: string) => {
    const snapshot = tracks;
    setTracks((current) => current.filter((track) => track.id !== trackId));

    try {
      await apiFetch(
        `/api/playlists/${playlist.id}/tracks?trackId=${encodeURIComponent(trackId)}`,
        { method: "DELETE" },
      );
      toast("Removed from folder");
      router.refresh();
    } catch (error) {
      setTracks(snapshot);
      toast(errorMessage(error), "error");
    }
  };

  const moveTrack = async (trackId: string, direction: "up" | "down") => {
    const index = tracks.findIndex((track) => track.id === trackId);
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (index === -1 || targetIndex < 0 || targetIndex >= tracks.length) return;

    const snapshot = tracks;
    const reordered = [...tracks];
    [reordered[index], reordered[targetIndex]] = [
      reordered[targetIndex],
      reordered[index],
    ];
    setTracks(reordered);

    try {
      await apiFetch(`/api/playlists/${playlist.id}/tracks/move`, {
        method: "POST",
        body: JSON.stringify({ trackId, direction }),
      });
      router.refresh();
    } catch (error) {
      setTracks(snapshot);
      toast(errorMessage(error), "error");
    }
  };

  const saveEdits = async () => {
    const trimmed = name.trim();
    if (!trimmed || busy) return;

    setBusy(true);
    try {
      await apiFetch(`/api/playlists/${playlist.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: trimmed,
          description: description.trim() || null,
          accent,
        }),
      });

      toast("Folder updated", "success");
      setEditOpen(false);
      router.refresh();
    } catch (error) {
      toast(errorMessage(error), "error");
    } finally {
      setBusy(false);
    }
  };

  const deletePlaylist = async () => {
    setBusy(true);
    try {
      await apiFetch(`/api/playlists/${playlist.id}`, { method: "DELETE" });
      toast("Folder deleted");
      router.push("/playlists");
      router.refresh();
    } catch (error) {
      toast(errorMessage(error), "error");
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between pt-[calc(env(safe-area-inset-top)_+_18px)]">
        <Link
          href="/playlists"
          className="tap grid h-10 w-10 place-items-center rounded-full bg-ink/[0.06] text-ink"
          aria-label="Back to folders"
        >
          <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={2.2} />
        </Link>

        <button
          type="button"
          onClick={() => setEditOpen(true)}
          className="tap grid h-10 w-10 place-items-center rounded-full bg-ink/[0.06] text-ink"
          aria-label="Folder settings"
        >
          <Settings2 className="h-[17px] w-[17px]" strokeWidth={2.1} />
        </button>
      </div>

      <header className="mt-5">
        <div
          className={cn(
            "grid h-[74px] w-[74px] place-items-center rounded-[22px]",
            accent === "ember"
              ? "bg-[#B4552F]/15 text-[#B4552F]"
              : accent === "moss"
                ? "bg-[#7E7A5A]/15 text-[#6C6849]"
                : accent === "ocean"
                  ? "bg-[#6F7C80]/15 text-[#5A676B]"
                  : accent === "violet"
                    ? "bg-[#7A6E86]/15 text-[#6B5F77]"
                    : accent === "sand"
                      ? "bg-[#C9A97A]/20 text-[#9A7A4C]"
                      : "bg-amber/15 text-amber-deep",
          )}
        >
          <span className="flex h-6 items-end gap-[3px]">
            <span className="h-1/2 w-[3px] rounded-full bg-current" />
            <span className="h-full w-[3px] rounded-full bg-current" />
            <span className="h-2/3 w-[3px] rounded-full bg-current" />
            <span className="h-3/4 w-[3px] rounded-full bg-current/70" />
          </span>
        </div>

        <h1 className="mt-4 font-display text-[30px] leading-[1.05] tracking-[-0.02em] text-ink">
          {playlist.name}
        </h1>

        <p className="mt-1.5 text-[12px] font-medium text-ink-muted">
          {tracks.length} {tracks.length === 1 ? "track" : "tracks"}
          {totalMinutes ? ` · ${totalMinutes} min` : ""}
        </p>

        {playlist.description ? (
          <p className="mt-2 text-[12.5px] leading-relaxed text-ink-muted">
            {playlist.description}
          </p>
        ) : null}
      </header>

      <div className="mt-5 flex items-center gap-2.5">
        <Button onClick={() => playAll(false)} className="flex-1" size="lg">
          <Play className="h-4 w-4 fill-ink" strokeWidth={0} />
          Play all
        </Button>
        <button
          type="button"
          onClick={() => playAll(true)}
          aria-label="Shuffle folder"
          className="tap grid h-[52px] w-[52px] shrink-0 place-items-center rounded-full border border-ink/15 text-ink"
        >
          <Shuffle className="h-[18px] w-[18px]" strokeWidth={2.2} />
        </button>
      </div>

      <div className="mt-6">
        {tracks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-ink/15 px-4 py-7 text-center">
            <p className="text-[13.5px] font-semibold text-ink">This folder is empty</p>
            <p className="mx-auto mt-1 max-w-[240px] text-[12px] leading-relaxed text-ink-muted">
              Search a vibe, then tap the ＋ on any result to drop it in here.
            </p>
            <Link
              href="/search"
              className="mt-3.5 inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-[12px] font-semibold text-cream"
            >
              <Search className="h-3.5 w-3.5" strokeWidth={2.3} />
              Find tracks
            </Link>
          </div>
        ) : (
          <div className="space-y-0.5">
            {tracks.map((track, index) => (
              <PlaylistTrackRow
                key={track.id}
                track={track}
                index={index}
                isPlaying={player.isPlaying}
                onPlay={() => engine.setQueue(tracks, index, playlist.name)}
                onMove={(direction) => void moveTrack(track.id, direction)}
                onRemove={() => void removeTrack(track.id)}
                canMoveUp={index > 0}
                canMoveDown={index < tracks.length - 1}
              />
            ))}
          </div>
        )}
      </div>

      {/* Edit sheet */}
      <Sheet
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Folder settings"
      >
        <div className="space-y-4 pt-1">
          <label className="block">
            <span className="label-xs mb-1.5 block">Name</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={60}
              className="h-[50px] w-full rounded-2xl border border-ink/[0.08] bg-white/80 px-3.5 text-[15px] outline-none focus:border-amber/60"
            />
          </label>

          <label className="block">
            <span className="label-xs mb-1.5 block">Note</span>
            <input
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={200}
              placeholder="Optional"
              className="h-[50px] w-full rounded-2xl border border-ink/[0.08] bg-white/80 px-3.5 text-[15px] outline-none placeholder:text-ink-muted/60 focus:border-amber/60"
            />
          </label>

          <div>
            <span className="label-xs mb-2 block">Accent</span>
            <div className="flex gap-2.5">
              {ACCENTS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setAccent(option)}
                  aria-label={option}
                  aria-pressed={accent === option}
                  className={cn(
                    "h-8 w-8 rounded-full ring-offset-2 ring-offset-cream",
                    option === "amber" && "bg-amber",
                    option === "ember" && "bg-[#B4552F]",
                    option === "moss" && "bg-[#7E7A5A]",
                    option === "ocean" && "bg-[#6F7C80]",
                    option === "violet" && "bg-[#7A6E86]",
                    option === "sand" && "bg-[#C9A97A]",
                    accent === option ? "ring-2 ring-ink/60" : "opacity-60",
                  )}
                />
              ))}
            </div>
          </div>

          <Button
            fullWidth
            size="lg"
            onClick={() => void saveEdits()}
            disabled={busy || name.trim().length === 0}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save changes
          </Button>

          <button
            type="button"
            onClick={() => {
              setEditOpen(false);
              setDeleteOpen(true);
            }}
            className="flex w-full items-center justify-center gap-1.5 py-2 text-[12.5px] font-semibold text-[#7f2d20]"
          >
            <Trash2 className="h-3.5 w-3.5" strokeWidth={2.2} />
            Delete this folder
          </button>
        </div>
      </Sheet>

      {/* Delete confirmation */}
      <Sheet
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete folder?"
        subtitle="This removes the folder and its track list. Your saved tracks stay."
      >
        <div className="space-y-2 pt-1">
          <Button
            variant="danger"
            fullWidth
            size="lg"
            onClick={() => void deletePlaylist()}
            disabled={busy}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Yes, delete it
          </Button>
          <Button variant="ghost" fullWidth onClick={() => setDeleteOpen(false)}>
            Keep it
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
