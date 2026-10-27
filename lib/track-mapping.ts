import { makeTrackId, type Track, type TrackProvider } from "@/lib/tracks";
import type { TrackPayload } from "@/lib/validation";

/** Shape accepted by `addTrackToPlaylist` / `toggleFavorite`. */
export interface TrackRowInput {
  id: string;
  provider: string;
  providerId: string;
  title: string;
  artist: string;
  album: string | null;
  artwork: string | null;
  duration: number | null;
  streamUrl: string | null;
  externalUrl: string | null;
  kind: string;
  isPreview: boolean;
}

/** Normalises a validated wire payload into a persistable row. */
export function payloadToRow(payload: TrackPayload): TrackRowInput {
  return {
    id: payload.id ?? makeTrackId(payload.provider, payload.providerId),
    provider: payload.provider,
    providerId: payload.providerId,
    title: payload.title,
    artist: payload.artist,
    album: payload.album ?? null,
    artwork: payload.artwork ?? null,
    duration: payload.duration ?? null,
    streamUrl: payload.streamUrl ?? null,
    externalUrl: payload.externalUrl ?? null,
    kind: payload.kind,
    isPreview: payload.isPreview,
  };
}

/** Converts a client Track into the same persistable row shape. */
export function trackToRow(track: Track): TrackRowInput {
  return {
    id: track.id,
    provider: track.provider,
    providerId: track.providerId,
    title: track.title,
    artist: track.artist,
    album: track.album,
    artwork: track.artwork,
    duration: track.duration,
    streamUrl: track.streamUrl,
    externalUrl: track.externalUrl,
    kind: track.kind,
    isPreview: track.isPreview,
  };
}

export function isKnownProvider(value: string): value is TrackProvider {
  return value === "audius" || value === "archive";
}
