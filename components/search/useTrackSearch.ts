"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { apiFetch, errorMessage } from "@/lib/api-client";
import type { Track } from "@/lib/tracks";

export interface SourceStatus {
  provider: string;
  label: string;
  status: "ok" | "skipped" | "error";
  count: number;
  message?: string;
}

export interface SearchPayload {
  query: string;
  tracks: Track[];
  sources: SourceStatus[];
  tookMs: number;
}

export type SearchStatus = "idle" | "loading" | "success" | "error";

const DEBOUNCE_MS = 320;
const MIN_QUERY_LENGTH = 2;

/**
 * Debounced multi-source search with abort handling.
 *
 * `search()` returns the payload so callers (chips, mood cards) can start
 * playback the moment results land, without waiting for a re-render.
 */
export function useTrackSearch(initialQuery = "") {
  const [query, setQuery] = useState(initialQuery);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [sources, setSources] = useState<SourceStatus[]>([]);
  const [status, setStatus] = useState<SearchStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [tookMs, setTookMs] = useState<number | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);

  const search = useCallback(async (raw: string): Promise<SearchPayload | null> => {
    const trimmed = raw.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) return null;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const requestId = ++requestIdRef.current;
    setStatus("loading");
    setError(null);

    try {
      const data = await apiFetch<SearchPayload>(
        `/api/search?q=${encodeURIComponent(trimmed)}&limit=30`,
        { signal: controller.signal },
      );

      if (controller.signal.aborted || requestId !== requestIdRef.current) return null;

      setTracks(data.tracks);
      setSources(data.sources);
      setTookMs(data.tookMs);
      setStatus("success");
      return data;
    } catch (caught) {
      if (controller.signal.aborted || requestId !== requestIdRef.current) return null;
      setError(errorMessage(caught));
      setStatus("error");
      return null;
    }
  }, []);

  useEffect(() => {
    const trimmed = query.trim();

    if (trimmed.length < MIN_QUERY_LENGTH) {
      abortRef.current?.abort();
      requestIdRef.current += 1;
      setTracks([]);
      setSources([]);
      setStatus("idle");
      setError(null);
      return;
    }

    const timer = window.setTimeout(() => {
      void search(trimmed);
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [query, search]);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    requestIdRef.current += 1;
    setQuery("");
    setTracks([]);
    setSources([]);
    setStatus("idle");
    setError(null);
  }, []);

  return {
    query,
    setQuery,
    tracks,
    sources,
    status,
    error,
    tookMs,
    search,
    reset,
    active: query.trim().length >= MIN_QUERY_LENGTH,
  };
}
