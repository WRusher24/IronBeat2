/**
 * Client-side YouTube IFrame adapter.
 *
 * Kept deliberately thin: it exposes exactly the transport surface the
 * AudioEngine needs and nothing else. The player is created lazily on first
 * use and reused for the lifetime of the page (creating players is expensive
 * and leaks iframes on mobile Safari).
 */

interface YTPlayerLike {
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  setVolume: (volume: number) => void;
  mute: () => void;
  unMute: () => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  loadVideoById: (videoId: string) => void;
  destroy: () => void;
  getPlayerState: () => number;
}

interface YTNamespace {
  Player: new (
    element: HTMLElement | string,
    options: Record<string, unknown>,
  ) => YTPlayerLike;
  PlayerState: {
    UNSTARTED: number;
    ENDED: number;
    PLAYING: number;
    PAUSED: number;
    BUFFERING: number;
    CUED: number;
  };
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

export const YT_STATE = {
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5,
} as const;

let apiPromise: Promise<YTNamespace> | null = null;

function loadIframeApi(): Promise<YTNamespace> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("YouTube player requires a browser"));
  }

  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;

  apiPromise = new Promise<YTNamespace>((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;

    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      if (window.YT?.Player) resolve(window.YT);
      else reject(new Error("YouTube IFrame API failed to initialise"));
    };

    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://www.youtube.com/iframe_api"]',
    );

    if (!existing) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      script.onerror = () => reject(new Error("Could not load the YouTube player"));
      document.head.appendChild(script);
    }

    // Safety net: the API occasionally never fires its ready callback on
    // flaky mobile connections.
    window.setTimeout(() => {
      if (window.YT?.Player) resolve(window.YT);
    }, 8000);
  });

  return apiPromise;
}

export class YouTubeAdapter {
  private player: YTPlayerLike | null = null;
  private host: HTMLDivElement | null = null;
  private creating: Promise<void> | null = null;
  private pendingVideoId: string | null = null;
  private volume = 1;
  private muted = false;

  onStateChange: ((state: number) => void) | null = null;
  onError: ((code: number) => void) | null = null;

  get isReady(): boolean {
    return this.player !== null;
  }

  private mountHost(): HTMLElement {
    if (this.host?.isConnected) return this.host;

    const host = document.createElement("div");
    host.id = "ironbeat-yt-host";
    // Off-screen rather than `display:none`: some mobile browsers refuse to
    // decode media inside a display:none subtree.
    host.style.cssText = [
      "position:fixed",
      "left:-9999px",
      "top:0",
      "width:240px",
      "height:240px",
      "opacity:0.01",
      "pointer-events:none",
      "z-index:-1",
    ].join(";");

    const target = document.createElement("div");
    target.id = "ironbeat-yt-player";
    host.appendChild(target);
    document.body.appendChild(host);

    this.host = host;
    return host;
  }

  private async create(): Promise<void> {
    if (this.player) return;
    if (this.creating) return this.creating;

    this.creating = (async () => {
      const YT = await loadIframeApi();
      this.mountHost();

      await new Promise<void>((resolve, reject) => {
        const timeout = window.setTimeout(
          () => reject(new Error("YouTube player timed out")),
          10000,
        );

        const player = new YT.Player("ironbeat-yt-player", {
          height: "240",
          width: "240",
          videoId: this.pendingVideoId ?? undefined,
          playerVars: {
            autoplay: 0,
            controls: 0,
            disablekb: 1,
            fs: 0,
            playsinline: 1,
            rel: 0,
            modestbranding: 1,
            origin: window.location.origin,
          },
          events: {
            onReady: () => {
              window.clearTimeout(timeout);
              this.player = player;
              player.setVolume(Math.round(this.volume * 100));
              if (this.muted) player.mute();
              resolve();
            },
            onStateChange: (event: { data: number }) => {
              this.onStateChange?.(event.data);
            },
            onError: (event: { data: number }) => {
              this.onError?.(event.data);
            },
          },
        });
      });
    })().finally(() => {
      this.creating = null;
    });

    return this.creating;
  }

  async load(videoId: string): Promise<void> {
    this.pendingVideoId = videoId;

    if (!this.player) {
      await this.create();
    }

    if (this.player) {
      this.player.loadVideoById(videoId);
    }
  }

  async play(): Promise<void> {
    if (!this.player) {
      if (this.pendingVideoId) await this.load(this.pendingVideoId);
      return;
    }
    this.player.playVideo();
  }

  pause(): void {
    this.player?.pauseVideo();
  }

  seek(seconds: number): void {
    this.player?.seekTo(seconds, true);
  }

  setVolume(value: number): void {
    this.volume = value;
    this.player?.setVolume(Math.round(value * 100));
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (!this.player) return;
    if (muted) this.player.mute();
    else this.player.unMute();
  }

  getCurrentTime(): number {
    try {
      return this.player?.getCurrentTime() ?? 0;
    } catch {
      return 0;
    }
  }

  getDuration(): number {
    try {
      return this.player?.getDuration() ?? 0;
    } catch {
      return 0;
    }
  }
}

export function isYouTubeTrackId(videoId: string): boolean {
  return /^[a-zA-Z0-9_-]{11}$/.test(videoId);
}
