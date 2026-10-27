"use client";

import { Check, Loader2, Plus } from "lucide-react";
import { useEffect, useState } from "react";

import { useToast } from "@/components/providers/ToastProvider";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { apiFetch, errorMessage } from "@/lib/api-client";
import type { Track } from "@/lib/tracks";
import { cn } from "@/lib/utils";

interface PlaylistSummary {
  id: string;
  name: string;
  trackCount: number;
  accent: string;
}

const ACCENT_DOT: Record<string, string> = {
  amber: "bg-amber",
  ember: "bg-[#B4552F]",
  moss: "bg-[#7E7A5A]",
  ocean: "bg-[#6F7C80]",
  violet: "bg-[#7A6E86]",
  sand: "bg-[#C9A97A]",
};

export function AddToPlaylistSheet({
  track,
  open,
  onClose,
}: {
  track: Track;
  open: boolean;
  onClose: () => void;
}) {
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [addedTo, setAddedTo] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [creatingBusy, setCreatingBusy] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setLoading(true);
    setAddedTo(null);

    apiFetch<{ playlists: PlaylistSummary[] }>("/api/playlists")
      .then((data) => {
        if (!cancelled) setPlaylists(data.playlists);
      })
      .catch(() => {
        if (!cancelled) toast("Couldn't load your playlists", "error");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, toast]);

  const addTo = async (playlistId: string) => {
    setAddingTo(playlistId);
    try {
      const result = await apiFetch<{ status: "added" | "duplicate" }>(
        `/api/playlists/${playlistId}/tracks`,
        { method: "POST", body: JSON.stringify({ track }) },
      );

      setAddedTo(playlistId);
      toast(
        result.status === "duplicate" ? "Already in that playlist" : "Added to playlist",
        result.status === "duplicate" ? "default" : "success",
      );

      setPlaylists((current) =>
        current.map((playlist) =>
          playlist.id === playlistId && result.status === "added"
            ? { ...playlist, trackCount: playlist.trackCount + 1 }
            : playlist,
        ),
      );

      window.setTimeout(onClose, 450);
    } catch (error) {
      toast(errorMessage(error), "error");
    } finally {
      setAddingTo(null);
    }
  };

  const createAndAdd = async () => {
    const name = newName.trim();
    if (!name) return;

    setCreatingBusy(true);
    try {
      const created = await apiFetch<{ playlist: PlaylistSummary }>("/api/playlists", {
        method: "POST",
        body: JSON.stringify({ name }),
      });

      await apiFetch(`/api/playlists/${created.playlist.id}/tracks`, {
        method: "POST",
        body: JSON.stringify({ track }),
      });

      toast(`Saved to “${created.playlist.name}”`, "success");
      setNewName("");
      setCreating(false);
      window.setTimeout(onClose, 400);
    } catch (error) {
      toast(errorMessage(error), "error");
    } finally {
      setCreatingBusy(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Add to a folder"
      subtitle={track.title}
    >
      {loading ? (
        <div className="space-y-2 py-2">
          {[0, 1, 2].map((row) => (
            <div key={row} className="skeleton h-14 w-full" />
          ))}
        </div>
      ) : (
        <div className="space-y-1.5">
          {playlists.length === 0 ? (
            <p className="py-3 text-[13.5px] leading-relaxed text-ink-muted">
              No training folders yet. Create one below and this track goes
              straight into it.
            </p>
          ) : null}

          {playlists.map((playlist) => {
            const isAdded = addedTo === playlist.id;
            return (
              <button
                key={playlist.id}
                type="button"
                onClick={() => void addTo(playlist.id)}
                disabled={addingTo !== null}
                className="flex w-full items-center gap-3 rounded-2xl bg-white/70 px-3.5 py-3 text-left transition-colors hover:bg-white disabled:opacity-60"
              >
                <span
                  className={cn(
                    "h-9 w-9 shrink-0 rounded-xl",
                    ACCENT_DOT[playlist.accent] ?? "bg-amber",
                  )}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold text-ink">
                    {playlist.name}
                  </span>
                  <span className="block text-[11.5px] text-ink-muted">
                    {playlist.trackCount} {playlist.trackCount === 1 ? "track" : "tracks"}
                  </span>
                </span>
                {addingTo === playlist.id ? (
                  <Loader2 className="h-4 w-4 animate-spin text-ink-muted" />
                ) : isAdded ? (
                  <Check className="h-4 w-4 text-amber" strokeWidth={2.6} />
                ) : (
                  <Plus className="h-4 w-4 text-ink-muted" strokeWidth={2.2} />
                )}
              </button>
            );
          })}

          {creating ? (
            <div className="mt-3 space-y-2 rounded-2xl bg-white/70 p-3">
              <input
                autoFocus
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void createAndAdd();
                }}
                placeholder="e.g. Push day — heavy"
                maxLength={60}
                className="w-full rounded-xl border border-ink/10 bg-cream px-3 py-2.5 text-[14px] outline-none placeholder:text-ink-muted/70 focus:border-amber/60"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => void createAndAdd()}
                  disabled={creatingBusy || newName.trim().length === 0}
                  className="flex-1"
                >
                  {creatingBusy ? "Creating…" : "Create & add"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setCreating(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="mt-2 flex w-full items-center gap-3 rounded-2xl border border-dashed border-ink/15 px-3.5 py-3 text-left text-[13.5px] font-semibold text-ink-muted transition-colors hover:border-amber/50 hover:text-ink"
            >
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-ink/[0.05]">
                <Plus className="h-4 w-4" strokeWidth={2.2} />
              </span>
              New training folder
            </button>
          )}
        </div>
      )}
    </Sheet>
  );
}
