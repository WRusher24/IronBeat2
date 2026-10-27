import type { Track } from "@/lib/tracks";

import {
  markPlaybackSession,
  onAudioSessionStateChange,
  releasePlaybackSession,
} from "./audio-session";
import { YouTubeAdapter, YT_STATE } from "./youtube";

/**
 * IronBeat audio engine.
 *
 * A framework-agnostic state machine that owns two playback backends:
 *
 *   • HTMLAudioElement  — direct streams (Audius, Archive.org)
 *   • YouTube IFrame    — official player for YouTube search results
 *
 * YouTube is the priority catalogue, and its only sanctioned playback route is
 * the IFrame Player. That player is owned by a cross-origin document, so iOS
 * may suspend it when the app is backgrounded — the Audio Session and Media
 * Session declarations below keep the page's own media session alive, but they
 * cannot override the iframe's lifecycle. HTML5-backed tracks (Audius,
 * Archive.org) keep playing through a lock in every case.
 *
 * The `<audio>` element is attached to the document rather than kept detached:
 * iOS treats detached media elements as disposable and may stop them when the
 * page is backgrounded.
 *
 * React never touches the backends directly; it subscribes through
 * `useSyncExternalStore`, so transport logic stays testable and Media Session /
 * lock-screen controls live in exactly one place.
 */

export type RepeatMode = "off" | "one" | "all";

export interface PlayerState {
  queue: Track[];
  index: number;
  current: Track | null;
  isPlaying: boolean;
  isLoading: boolean;
  /** iOS blocked autoplay — the UI must show a tap-to-resume affordance. */
  needsGesture: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  muted: boolean;
  repeat: RepeatMode;
  shuffle: boolean;
  contextLabel: string;
  error: string | null;
  hydrated: boolean;
}

const STORAGE_KEY = "ironbeat.player.v1";
const VOLUME_KEY = "ironbeat.volume.v1";
const MAX_PERSISTED_QUEUE = 120;

/** 50ms of silence used to unlock the iOS audio session on a tap. */
const SILENT_WAV_DATA_URI = (() => {
  const sampleRate = 8000;
  const sampleCount = 400;
  const bytes = new Uint8Array(44 + sampleCount * 2);
  const view = new DataView(bytes.buffer);
  const writeString = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i += 1) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + sampleCount * 2, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, sampleCount * 2, true);

  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return `data:audio/wav;base64,${btoa(binary)}`;
})();

export const INITIAL_PLAYER_STATE: PlayerState = {
  queue: [],
  index: 0,
  current: null,
  isPlaying: false,
  isLoading: false,
  needsGesture: false,
  currentTime: 0,
  duration: 0,
  volume: 1,
  muted: false,
  repeat: "off",
  shuffle: false,
  contextLabel: "",
  error: null,
  hydrated: false,
};

interface PersistedState {
  queue: Track[];
  index: number;
  currentTime: number;
  repeat: RepeatMode;
  shuffle: boolean;
  contextLabel: string;
}

type Listener = () => void;
type TrackStartListener = (track: Track, contextLabel: string) => void;

function isRepeatMode(value: unknown): value is RepeatMode {
  return value === "off" || value === "one" || value === "all";
}

export class AudioEngine {
  private state: PlayerState = INITIAL_PLAYER_STATE;
  private listeners = new Set<Listener>();
  private trackStartListeners = new Set<TrackStartListener>();

  private audio: HTMLAudioElement | null = null;
  private yt = new YouTubeAdapter();

  /** Playback order over `queue` indices. Identity order unless shuffled. */
  private order: number[] = [];
  private loadToken = 0;
  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  private ytTicker: ReturnType<typeof setInterval> | null = null;
  private lastTimeEmit = 0;
  private pendingResumeTime = 0;
  private loadedVideoId: string | null = null;
  private unlocked = false;
  private consecutiveFailures = 0;
  private skipTimer: ReturnType<typeof setTimeout> | null = null;
  private mediaSessionReady = false;
  private detachAudioSession: (() => void) | null = null;

  constructor() {
    this.yt.onStateChange = (state) => this.handleYouTubeState(state);
    this.yt.onError = () => this.handlePlaybackFailure("This video can't be played here.");
  }

  // -------------------------------------------------------------------------
  // Subscription
  // -------------------------------------------------------------------------

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): PlayerState => this.state;

  onTrackStart = (listener: TrackStartListener): (() => void) => {
    this.trackStartListeners.add(listener);
    return () => {
      this.trackStartListeners.delete(listener);
    };
  };

  private patch(partial: Partial<PlayerState>): void {
    this.state = { ...this.state, ...partial };
    for (const listener of this.listeners) listener();
    this.schedulePersist();
  }

  // -------------------------------------------------------------------------
  // Media elements
  // -------------------------------------------------------------------------

  private ensureAudio(): HTMLAudioElement {
    if (this.audio) return this.audio;

    const audio = document.createElement("audio");
    audio.id = "ironbeat-audio";
    audio.preload = "metadata";
    audio.volume = this.state.volume;
    // Keeps the iOS audio session alive when the app is backgrounded and hands
    // control to the lock screen / AirPods.
    audio.setAttribute("playsinline", "true");
    audio.setAttribute("webkit-playsinline", "true");
    audio.setAttribute("x-webkit-airplay", "allow");
    audio.setAttribute("aria-hidden", "true");
    audio.tabIndex = -1;
    // Off-screen rather than display:none — some mobile browsers suspend media
    // inside a display:none subtree. Attached to the document because detached
    // Audio objects get reclaimed when the page is backgrounded.
    audio.style.cssText =
      "position:fixed;left:-9999px;bottom:0;width:1px;height:1px;opacity:0;pointer-events:none;";

    if (typeof document !== "undefined" && document.body) {
      document.body.appendChild(audio);
    }

    audio.addEventListener("loadedmetadata", () => {
      const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
      if (this.pendingResumeTime > 0 && duration > 0) {
        audio.currentTime = Math.min(this.pendingResumeTime, Math.max(duration - 1, 0));
        this.pendingResumeTime = 0;
      }
      this.patch({
        duration: duration > 0 ? duration : this.state.duration,
        currentTime: audio.currentTime,
      });
    });

    audio.addEventListener("timeupdate", () => {
      const now =
        typeof performance !== "undefined" ? performance.now() : Date.now();
      if (now - this.lastTimeEmit < 200) return;
      this.lastTimeEmit = now;
      this.patch({ currentTime: audio.currentTime });
      this.syncPositionState();
    });

    audio.addEventListener("playing", () => {
      this.consecutiveFailures = 0;
      this.patch({
        isPlaying: true,
        isLoading: false,
        needsGesture: false,
        error: null,
      });
      this.updatePlaybackState("playing");
    });

    audio.addEventListener("pause", () => {
      if (this.state.isPlaying) this.patch({ isPlaying: false });
      this.updatePlaybackState("paused");
    });

    audio.addEventListener("waiting", () => {
      this.patch({ isLoading: true });
    });

    audio.addEventListener("canplay", () => {
      if (this.state.isLoading) this.patch({ isLoading: false });
    });

    audio.addEventListener("ended", () => {
      this.handleEnded();
    });

    audio.addEventListener("error", () => {
      const code = audio.error?.code;
      const message =
        code === 4
          ? "This track can't be streamed right now."
          : "Playback failed. Check your connection.";
      this.handlePlaybackFailure(message);
    });

    this.audio = audio;
    return audio;
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  /** Restores the last session from localStorage. Safe to call repeatedly. */
  hydrate = (): void => {
    if (this.state.hydrated || typeof window === "undefined") return;

    // `Number(null)` is 0, so a missing key must be handled explicitly —
    // otherwise every first-time visitor starts at zero volume and hears
    // nothing while the UI happily reports "playing".
    const storedVolume = window.localStorage.getItem(VOLUME_KEY);
    const parsedVolume = storedVolume === null ? Number.NaN : Number(storedVolume);
    const volume =
      Number.isFinite(parsedVolume) && parsedVolume >= 0 && parsedVolume <= 1
        ? parsedVolume
        : 1;

    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<PersistedState>;
        const queue = Array.isArray(parsed.queue) ? parsed.queue : [];

        if (queue.length > 0) {
          const index = Math.min(
            Math.max(Number(parsed.index ?? 0) || 0, 0),
            queue.length - 1,
          );

          this.order = Array.from({ length: queue.length }, (_, i) => i);
          this.state = {
            ...this.state,
            queue,
            index,
            current: queue[index] ?? null,
            currentTime: Number(parsed.currentTime ?? 0) || 0,
            duration: queue[index]?.duration ?? 0,
            repeat: isRepeatMode(parsed.repeat) ? parsed.repeat : "off",
            shuffle: parsed.shuffle === true,
            contextLabel:
              typeof parsed.contextLabel === "string" ? parsed.contextLabel : "",
            volume,
            hydrated: true,
          };

          if (this.state.shuffle) this.rebuildOrder();

          for (const listener of this.listeners) listener();
        } else {
          this.state = { ...this.state, volume, hydrated: true };
          for (const listener of this.listeners) listener();
        }
      } else {
        this.state = { ...this.state, volume, hydrated: true };
        for (const listener of this.listeners) listener();
      }
    } catch {
      this.state = { ...this.state, volume, hydrated: true };
      for (const listener of this.listeners) listener();
    }

    this.setupMediaSession();
    this.updateMediaSession(this.state.current);
    this.setupAudioSession();
  };

  /**
   * Declares an iOS media session and tracks interruptions.
   *
   * Without `audioSession.type = "playback"`, iOS treats web audio as
   * incidental and can stop it when the app is backgrounded.
   */
  private setupAudioSession(): void {
    markPlaybackSession();

    if (this.detachAudioSession) return;

    this.detachAudioSession = onAudioSessionStateChange((state) => {
      if (state === "interrupted") {
        // A call or Siri took the session. Reflect it; don't fight it.
        this.patch({ isPlaying: false, isLoading: false });
        this.updatePlaybackState("paused");
      }
    });
  }

  private schedulePersist(): void {
    if (typeof window === "undefined") return;
    if (this.persistTimer) clearTimeout(this.persistTimer);

    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      try {
        const payload: PersistedState = {
          queue: this.state.queue.slice(0, MAX_PERSISTED_QUEUE),
          index: this.state.index,
          currentTime: this.state.currentTime,
          repeat: this.state.repeat,
          shuffle: this.state.shuffle,
          contextLabel: this.state.contextLabel,
        };
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        window.localStorage.setItem(VOLUME_KEY, String(this.state.volume));
      } catch {
        // Storage can be full or blocked (private mode) — playback continues.
      }
    }, 400);
  }

  // -------------------------------------------------------------------------
  // Queue control
  // -------------------------------------------------------------------------

  setQueue = (
    tracks: Track[],
    startIndex = 0,
    contextLabel = "",
    options: { shuffle?: boolean } = {},
  ): void => {
    if (tracks.length === 0) return;

    const index = Math.min(Math.max(startIndex, 0), tracks.length - 1);

    this.patch({
      queue: tracks,
      index,
      current: tracks[index],
      currentTime: 0,
      duration: tracks[index]?.duration ?? 0,
      contextLabel,
      error: null,
      isPlaying: false,
      needsGesture: false,
      shuffle: options.shuffle ?? this.state.shuffle,
    });

    this.rebuildOrder();
    void this.loadCurrent(true);
  };

  /** Appends tracks to the live queue without interrupting playback. */
  enqueue = (tracks: Track[]): void => {
    if (tracks.length === 0) return;

    const existing = new Set(this.state.queue.map((track) => track.id));
    const additions = tracks.filter((track) => !existing.has(track.id));
    if (additions.length === 0) return;

    const queue = [...this.state.queue, ...additions];
    this.patch({ queue });

    this.rebuildOrder();
  };

  jumpTo = (index: number): void => {
    if (index < 0 || index >= this.state.queue.length) return;
    if (index === this.state.index) {
      void this.play();
      return;
    }
    this.patch({
      index,
      current: this.state.queue[index],
      currentTime: 0,
      duration: this.state.queue[index]?.duration ?? 0,
      error: null,
    });
    void this.loadCurrent(true);
  };

  next = (fromEnded = false): void => {
    const { queue, index, repeat } = this.state;
    if (queue.length === 0) return;

    if (repeat === "one" && fromEnded) {
      this.seek(0);
      void this.play();
      return;
    }

    const order = this.currentOrder();
    const position = order.indexOf(index);
    let nextPosition = position + 1;

    if (nextPosition >= order.length) {
      if (repeat === "all") {
        nextPosition = 0;
      } else {
        this.pause();
        this.seek(0);
        return;
      }
    }

    this.jumpTo(order[nextPosition]);
  };

  previous = (): void => {
    const { queue, index, currentTime, repeat } = this.state;
    if (queue.length === 0) return;

    // Standard behaviour: restart the track if we're more than 3s in.
    if (currentTime > 3) {
      this.seek(0);
      return;
    }

    const order = this.currentOrder();
    const position = order.indexOf(index);
    let prevPosition = position - 1;

    if (prevPosition < 0) {
      if (repeat !== "all") {
        this.seek(0);
        return;
      }
      prevPosition = order.length - 1;
    }

    this.jumpTo(order[prevPosition]);
  };

  removeFromQueue = (index: number): void => {
    if (index < 0 || index >= this.state.queue.length) return;

    const wasCurrent = index === this.state.index;
    const wasPlaying = this.state.isPlaying;
    const queue = this.state.queue.filter((_, i) => i !== index);

    if (queue.length === 0) {
      this.clear();
      return;
    }

    let nextIndex = this.state.index;
    if (index < this.state.index) nextIndex = this.state.index - 1;
    if (wasCurrent) nextIndex = Math.min(this.state.index, queue.length - 1);

    this.patch({
      queue,
      index: nextIndex,
      current: queue[nextIndex],
    });

    this.rebuildOrder();

    if (wasCurrent) {
      void this.loadCurrent(wasPlaying);
    }
  };

  clear = (): void => {
    this.audio?.pause();
    if (this.audio) {
      this.audio.removeAttribute("src");
      delete this.audio.dataset.trackId;
      this.audio.load();
    }
    this.yt.pause();
    this.stopYouTubeTicker();
    releasePlaybackSession();
    this.order = [];
    this.patch({
      queue: [],
      index: 0,
      current: null,
      isPlaying: false,
      isLoading: false,
      currentTime: 0,
      duration: 0,
      contextLabel: "",
      error: null,
    });
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  };

  // -------------------------------------------------------------------------
  // Transport
  // -------------------------------------------------------------------------

  /**
   * Primes the audio element inside a user gesture.
   *
   * iOS only permits programmatic playback after a media element has been
   * started by a real tap. Search chips and mood cards need to await a network
   * round-trip before they know what to play, which breaks that chain — so we
   * unlock the element synchronously on tap and play for real once results
   * land. Without this, "one-tap pump" would need a second tap on iPhone.
   */
  unlock = (): void => {
    if (typeof window === "undefined" || this.unlocked || this.state.isPlaying) {
      return;
    }

    try {
      const audio = this.ensureAudio();
      const previousSrc = audio.getAttribute("src");
      const previousTime = audio.currentTime;

      audio.src = SILENT_WAV_DATA_URI;
      const promise = audio.play();

      const restore = () => {
        audio.pause();
        if (previousSrc) {
          audio.src = previousSrc;
          audio.currentTime = previousTime;
        } else {
          audio.removeAttribute("src");
          delete audio.dataset.trackId;
        }
      };

      if (promise) {
        promise
          .then(() => {
            this.unlocked = true;
            restore();
          })
          .catch(() => {
            restore();
          });
      } else {
        this.unlocked = true;
        restore();
      }
    } catch {
      // Non-fatal — the player will fall back to the tap-to-start overlay.
    }
  };

  play = async (): Promise<void> => {
    const track = this.state.current;
    if (!track) return;

    // Re-declare the iOS session on every play: an interruption (call, Siri)
    // resets it to the default category.
    markPlaybackSession();

    this.patch({ error: null, isLoading: true });

    if (track.kind === "video") {
      try {
        // Only (re)load when the video actually changed — otherwise resuming
        // from pause would restart the track from zero.
        if (this.loadedVideoId !== track.providerId) {
          await this.yt.load(track.providerId);
          this.loadedVideoId = track.providerId;
        }
        await this.yt.play();
        this.startYouTubeTicker();
        this.patch({ isPlaying: true, needsGesture: false });
        this.updatePlaybackState("playing");
      } catch {
        this.patch({
          isPlaying: false,
          isLoading: false,
          needsGesture: true,
        });
      }
      return;
    }

    const audio = this.ensureAudio();

    if (audio.dataset.trackId !== track.id) {
      if (!track.streamUrl) {
        this.handlePlaybackFailure("This track has no playable stream.");
        return;
      }
      audio.src = track.streamUrl;
      audio.dataset.trackId = track.id;
      audio.load();
    }

    try {
      await audio.play();
      this.patch({ needsGesture: false });
    } catch (error) {
      const name = error instanceof Error ? error.name : "";
      this.patch({
        isPlaying: false,
        isLoading: false,
        needsGesture: name === "NotAllowedError" || name === "AbortError",
        error:
          name === "NotAllowedError" || name === "AbortError"
            ? null
            : "Playback was blocked. Tap play again.",
      });
    }
  };

  pause = (): void => {
    if (this.state.current?.kind === "video") {
      this.yt.pause();
      this.stopYouTubeTicker();
    } else {
      this.audio?.pause();
    }
    this.patch({ isPlaying: false });
    this.updatePlaybackState("paused");
  };

  toggle = (): void => {
    if (this.state.isPlaying) this.pause();
    else void this.play();
  };

  seek = (seconds: number): void => {
    const duration = this.state.duration || this.state.current?.duration || 0;
    const target = Math.max(0, duration > 0 ? Math.min(seconds, duration) : seconds);

    if (this.state.current?.kind === "video") {
      this.yt.seek(target);
    } else if (this.audio) {
      this.audio.currentTime = target;
    }

    this.patch({ currentTime: target });
    this.syncPositionState();
  };

  skipBy = (delta: number): void => {
    this.seek(this.state.currentTime + delta);
  };

  setVolume = (value: number): void => {
    const volume = Math.min(Math.max(value, 0), 1);
    this.patch({ volume, muted: volume === 0 ? this.state.muted : false });
    if (this.audio) this.audio.volume = volume;
    this.yt.setVolume(volume);
  };

  toggleMute = (): void => {
    const muted = !this.state.muted;
    this.patch({ muted });
    if (this.audio) this.audio.muted = muted;
    this.yt.setMuted(muted);
  };

  cycleRepeat = (): void => {
    const nextMode: RepeatMode =
      this.state.repeat === "off"
        ? "all"
        : this.state.repeat === "all"
          ? "one"
          : "off";
    this.patch({ repeat: nextMode });
  };

  toggleShuffle = (): void => {
    const shuffle = !this.state.shuffle;
    this.patch({ shuffle });
    this.rebuildOrder();
  };

  // -------------------------------------------------------------------------
  // Internal playback plumbing
  // -------------------------------------------------------------------------

  private currentOrder(): number[] {
    if (this.order.length === this.state.queue.length) return this.order;
    this.rebuildOrder();
    return this.order;
  }

  private rebuildOrder(): void {
    const length = this.state.queue.length;
    const identity = Array.from({ length }, (_, i) => i);

    if (!this.state.shuffle) {
      this.order = identity;
      return;
    }

    const rest = identity.filter((i) => i !== this.state.index);
    for (let i = rest.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [rest[i], rest[j]] = [rest[j], rest[i]];
    }

    this.order = [this.state.index, ...rest];
  }

  private async loadCurrent(autoPlay: boolean): Promise<void> {
    const track = this.state.current;
    if (!track) return;

    const token = ++this.loadToken;
    this.consecutiveFailures = 0;

    this.patch({
      currentTime: 0,
      duration: track.duration ?? 0,
      isLoading: autoPlay,
      error: null,
    });

    this.updateMediaSession(track);
    markPlaybackSession();

    if (track.kind === "video") {
      this.audio?.pause();
      this.stopYouTubeTicker();

      if (!autoPlay) {
        this.patch({ isPlaying: false, isLoading: false });
        return;
      }

      try {
        await this.yt.load(track.providerId);
        this.loadedVideoId = track.providerId;
        if (token !== this.loadToken) return;
        await this.yt.play();
        if (token !== this.loadToken) return;
        this.startYouTubeTicker();
        this.patch({ isPlaying: true, isLoading: false });
        this.updatePlaybackState("playing");
        this.notifyTrackStart(track);
      } catch {
        if (token !== this.loadToken) return;
        this.patch({ isPlaying: false, isLoading: false, needsGesture: true });
      }
      return;
    }

    // Audio backend.
    this.yt.pause();
    this.stopYouTubeTicker();

    const audio = this.ensureAudio();
    audio.pause();

    if (!track.streamUrl) {
      this.handlePlaybackFailure("This track has no playable stream.");
      return;
    }

    audio.src = track.streamUrl;
    audio.dataset.trackId = track.id;
    audio.load();

    if (!autoPlay) {
      this.patch({ isPlaying: false, isLoading: false });
      return;
    }

    try {
      await audio.play();
      if (token !== this.loadToken) return;
      this.patch({ isPlaying: true, isLoading: false, needsGesture: false });
      this.updatePlaybackState("playing");
      this.notifyTrackStart(track);
    } catch (error) {
      if (token !== this.loadToken) return;
      const name = error instanceof Error ? error.name : "";
      const blocked = name === "NotAllowedError" || name === "AbortError";
      this.patch({
        isPlaying: false,
        isLoading: false,
        needsGesture: blocked,
        error: blocked ? null : "Playback failed. Tap to retry.",
      });
    }
  }

  private notifyTrackStart(track: Track): void {
    for (const listener of this.trackStartListeners) {
      try {
        listener(track, this.state.contextLabel);
      } catch {
        // A failing analytics listener must never break playback.
      }
    }
  }

  private handleEnded(): void {
    if (this.state.repeat === "one") {
      this.seek(0);
      void this.play();
      return;
    }
    this.next(true);
  }

  private handlePlaybackFailure(message: string): void {
    this.patch({ isPlaying: false, isLoading: false, error: message });
    this.consecutiveFailures += 1;

    if (this.skipTimer) clearTimeout(this.skipTimer);

    // Auto-advance past broken tracks, but never loop endlessly.
    if (this.consecutiveFailures <= 2 && this.state.queue.length > 1) {
      this.skipTimer = setTimeout(() => {
        this.skipTimer = null;
        this.next(true);
      }, 1400);
    }
  }

  private handleYouTubeState(state: number): void {
    if (state === YT_STATE.PLAYING) {
      this.consecutiveFailures = 0;
      const duration = this.yt.getDuration();
      this.patch({
        isPlaying: true,
        isLoading: false,
        needsGesture: false,
        error: null,
        duration: duration > 0 ? duration : this.state.duration,
      });
      this.updatePlaybackState("playing");
    } else if (state === YT_STATE.PAUSED) {
      this.patch({ isPlaying: false });
      this.updatePlaybackState("paused");
    } else if (state === YT_STATE.BUFFERING) {
      this.patch({ isLoading: true });
    } else if (state === YT_STATE.ENDED) {
      this.stopYouTubeTicker();
      this.handleEnded();
    }
  }

  private startYouTubeTicker(): void {
    this.stopYouTubeTicker();
    if (typeof window === "undefined") return;

    this.ytTicker = setInterval(() => {
      if (!this.state.isPlaying) return;
      const time = this.yt.getCurrentTime();
      const duration = this.yt.getDuration();
      this.patch({
        currentTime: time,
        duration: duration > 0 ? duration : this.state.duration,
      });
      this.syncPositionState();
    }, 500);
  }

  private stopYouTubeTicker(): void {
    if (this.ytTicker) {
      clearInterval(this.ytTicker);
      this.ytTicker = null;
    }
  }

  // -------------------------------------------------------------------------
  // Media Session (iOS lock screen / AirPods / Android notification)
  // -------------------------------------------------------------------------

  private setupMediaSession(): void {
    if (this.mediaSessionReady) return;
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;

    this.mediaSessionReady = true;
    const session = navigator.mediaSession;

    const handlers: Array<[MediaSessionAction, MediaSessionActionHandler]> = [
      ["play", () => void this.play()],
      ["pause", () => this.pause()],
      ["stop", () => this.pause()],
      ["nexttrack", () => this.next()],
      ["previoustrack", () => this.previous()],
      ["seekbackward", () => this.skipBy(-10)],
      ["seekforward", () => this.skipBy(10)],
      [
        "seekto",
        (details) => {
          if (typeof details.seekTime === "number") this.seek(details.seekTime);
        },
      ],
    ];

    for (const [action, handler] of handlers) {
      try {
        session.setActionHandler(action, handler);
      } catch {
        // Unsupported action on this browser — ignore.
      }
    }
  }

  private updateMediaSession(track: Track | null): void {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;

    if (!track) {
      navigator.mediaSession.metadata = null;
      return;
    }

    const fallbackArtwork =
      typeof window !== "undefined"
        ? `${window.location.origin}/icons/icon-512.png`
        : "/icons/icon-512.png";

    const artwork = track.artwork ?? fallbackArtwork;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artist,
      album: track.album ?? "IronBeat",
      artwork: [
        { src: artwork, sizes: "96x96" },
        { src: artwork, sizes: "256x256" },
        { src: artwork, sizes: "512x512" },
      ],
    });
  }

  private updatePlaybackState(state: "playing" | "paused" | "none"): void {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    try {
      navigator.mediaSession.playbackState = state;
    } catch {
      // Ignore — not fatal.
    }
  }

  private syncPositionState(): void {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    if (!navigator.mediaSession.setPositionState) return;

    const duration = this.state.duration;
    if (!duration || duration <= 0) return;

    try {
      navigator.mediaSession.setPositionState({
        duration,
        playbackRate: 1,
        position: Math.min(this.state.currentTime, duration),
      });
    } catch {
      // Safari throws if position > duration during a track switch.
    }
  }
}

let engine: AudioEngine | null = null;

/** Process-wide singleton. Safe to import during SSR (no DOM access at rest). */
export function getEngine(): AudioEngine {
  if (!engine) engine = new AudioEngine();
  return engine;
}
