"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { apiFetch } from "@/lib/api-client";
import type { Track } from "@/lib/tracks";

import { useToast } from "./ToastProvider";

interface FavoritesValue {
  ids: Set<string>;
  isFavorite: (trackId: string) => boolean;
  toggle: (track: Track) => Promise<void>;
  count: number;
  ready: boolean;
}

const FavoritesContext = createContext<FavoritesValue>({
  ids: new Set(),
  isFavorite: () => false,
  toggle: async () => undefined,
  count: 0,
  ready: false,
});

export function FavoritesProvider({
  children,
  authenticated,
}: {
  children: ReactNode;
  authenticated: boolean;
}) {
  const [ids, setIds] = useState<Set<string>>(new Set());
  const [ready, setReady] = useState(false);
  const toast = useToast();

  useEffect(() => {
    // Skip the round-trip on auth screens — there is no session yet.
    if (!authenticated) {
      setReady(true);
      return;
    }

    let cancelled = false;

    apiFetch<{ tracks: Track[] }>("/api/favorites")
      .then((data) => {
        if (cancelled) return;
        setIds(new Set(data.tracks.map((track) => track.id)));
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, [authenticated]);

  const isFavorite = useCallback((trackId: string) => ids.has(trackId), [ids]);

  const toggle = useCallback(
    async (track: Track) => {
      const wasFavorite = ids.has(track.id);

      // Optimistic flip — reverts if the request fails.
      setIds((current) => {
        const next = new Set(current);
        if (wasFavorite) next.delete(track.id);
        else next.add(track.id);
        return next;
      });

      try {
        const result = await apiFetch<{ favorited: boolean }>("/api/favorites", {
          method: "POST",
          body: JSON.stringify({ track }),
        });

        setIds((current) => {
          const next = new Set(current);
          if (result.favorited) next.add(track.id);
          else next.delete(track.id);
          return next;
        });

        toast(result.favorited ? "Saved to your vault" : "Removed from saved");
      } catch {
        setIds((current) => {
          const next = new Set(current);
          if (wasFavorite) next.add(track.id);
          else next.delete(track.id);
          return next;
        });
        toast("Couldn't update your saved tracks", "error");
      }
    },
    [ids, toast],
  );

  const value = useMemo<FavoritesValue>(
    () => ({ ids, isFavorite, toggle, count: ids.size, ready }),
    [ids, isFavorite, toggle, ready],
  );

  return (
    <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>
  );
}

export function useFavorites(): FavoritesValue {
  return useContext(FavoritesContext);
}
