"use client";

import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";

import { apiFetch } from "@/lib/api-client";
import {
  getEngine,
  INITIAL_PLAYER_STATE,
  type AudioEngine,
  type PlayerState,
} from "@/lib/audio/engine";
import type { Track } from "@/lib/tracks";

const PlayerContext = createContext<AudioEngine | null>(null);

/**
 * Mounts the engine, restores the last session and mirrors track starts into
 * the play log (which powers Smart Shuffle).
 */
export function PlayerProvider({
  children,
  authenticated,
}: {
  children: ReactNode;
  authenticated: boolean;
}) {
  const engine = useMemo(() => getEngine(), []);

  useEffect(() => {
    engine.hydrate();
  }, [engine]);

  useEffect(() => {
    if (!authenticated) return;

    return engine.onTrackStart((track: Track, contextLabel: string) => {
      void apiFetch("/api/history/plays", {
        method: "POST",
        body: JSON.stringify({
          trackId: track.id,
          provider: track.provider,
          title: track.title,
          artist: track.artist,
          artwork: track.artwork,
          contextLabel: contextLabel || null,
        }),
      }).catch(() => undefined);
    });
  }, [engine, authenticated]);

  return <PlayerContext.Provider value={engine}>{children}</PlayerContext.Provider>;
}

export function usePlayerEngine(): AudioEngine {
  const engine = useContext(PlayerContext);
  if (!engine) {
    throw new Error("usePlayerEngine must be used inside <PlayerProvider>");
  }
  return engine;
}

/** Reactive player state. Re-renders only the components that read it. */
export function usePlayerState(): PlayerState {
  const engine = usePlayerEngine();

  return useSyncExternalStore(
    engine.subscribe,
    engine.getSnapshot,
    () => INITIAL_PLAYER_STATE,
  );
}
