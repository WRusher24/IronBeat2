/**
 * Audio Session API (Safari 16.4+ / iOS 16.4+).
 *
 * `navigator.audioSession.type = "playback"` tells iOS this page is playing
 * long-form media rather than a transient sound effect. Without it, Safari may
 * treat the audio as incidental: it ducks or stops when the app is
 * backgrounded, and the lock screen shows no transport controls.
 *
 * Declaring the type does not bypass the platform's rules — it opts into the
 * correct category so the OS keeps the session alive the way it would for a
 * native music app. It is applied on init, re-applied before every play (iOS
 * resets the session after an interruption such as a call or Siri), and paired
 * with an interruption listener so the UI reflects reality.
 *
 * Not present on Chrome/Firefox/Android — every call is a no-op there, and
 * Media Session handles those platforms.
 */

interface AudioSessionLike {
  type: string;
  state: "inactive" | "active" | "interrupted" | string;
  onstatechange: (() => void) | null;
}

function getAudioSession(): AudioSessionLike | null {
  if (typeof navigator === "undefined") return null;
  const candidate = (navigator as unknown as { audioSession?: AudioSessionLike })
    .audioSession;
  return candidate ?? null;
}

export function isAudioSessionSupported(): boolean {
  return getAudioSession() !== null;
}

/**
 * Declares the session as media playback.
 * Safe to call repeatedly; call it again after any interruption.
 */
export function markPlaybackSession(): void {
  const session = getAudioSession();
  if (!session) return;

  try {
    if (session.type !== "playback") session.type = "playback";
  } catch {
    // Older Safari exposes the object but rejects the assignment.
  }
}

/** Returns the session to the default category, e.g. after the queue ends. */
export function releasePlaybackSession(): void {
  const session = getAudioSession();
  if (!session) return;

  try {
    session.type = "auto";
  } catch {
    // Ignore — cosmetic only.
  }
}

/**
 * Notifies when iOS interrupts playback (incoming call, Siri, another app
 * taking the session) and when it hands control back.
 */
export function onAudioSessionStateChange(
  handler: (state: AudioSessionLike["state"]) => void,
): () => void {
  const session = getAudioSession();
  if (!session) return () => undefined;

  const listener = () => handler(session.state);
  session.onstatechange = listener;

  return () => {
    if (session.onstatechange === listener) session.onstatechange = null;
  };
}
