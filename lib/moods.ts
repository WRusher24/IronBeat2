/**
 * The IronBeat "Moods & Vibe Deck".
 *
 * Each mood is a *dynamic* playlist: rather than shipping a frozen track list,
 * the deck expands a handful of curated seed queries across every configured
 * audio source at request time. That keeps moods fresh and means a lifter in
 * Cairo and a lifter in São Paulo both get locally relevant results.
 *
 * Ordering matters — the deck is rendered top-left to bottom-right, starting
 * with the highest-intensity vibes a gym session actually opens with.
 */

export interface Mood {
  slug: string;
  emoji: string;
  title: string;
  blurb: string;
  /** Short descriptor shown on the card (tempo / use case). */
  meta: string;
  /** 1 (calm) .. 5 (max intensity) — rendered as an energy meter. */
  energy: 1 | 2 | 3 | 4 | 5;
  /** Warm-neutral accent used for the card glow + progress tint. */
  glow: string;
  /** Seed queries, highest-signal first. */
  seeds: string[];
  /** Optional tail queries appended when a seed returns thin results. */
  fallbackSeeds?: string[];
}

export const MOODS: Mood[] = [
  {
    slug: "phonk-hype",
    emoji: "⚡",
    title: "Phonk & Hype",
    blurb: "Brazilian phonk, drift bass and 808s that hit like a new PR.",
    meta: "130–160 BPM",
    energy: 5,
    glow: "#C67D3B",
    seeds: ["brazilian phonk", "drift phonk", "phonk workout", "gym phonk"],
    fallbackSeeds: ["dark phonk", "memphis phonk"],
  },
  {
    slug: "aggressive-lift",
    emoji: "🔥",
    title: "Aggressive Lift",
    blurb: "Hard rock, metal and industrial for the heavy top set.",
    meta: "Heavy / max effort",
    energy: 5,
    glow: "#B4552F",
    seeds: ["hard rock workout", "metal lifting", "industrial metal", "heavy gym rock"],
    fallbackSeeds: ["nu metal", "thrash metal"],
  },
  {
    slug: "boxing-rounds",
    emoji: "🥊",
    title: "Boxing Rounds",
    blurb: "Boom-bap and hip-hop tempo built for three-minute rounds.",
    meta: "90–100 BPM",
    energy: 4,
    glow: "#9A6B3F",
    seeds: ["hip hop boxing", "boom bap training", "rap workout", "boxing motivation"],
    fallbackSeeds: ["old school hip hop", "trap workout"],
  },
  {
    slug: "sprint-intervals",
    emoji: "🏃",
    title: "Sprint Intervals",
    blurb: "Drum & bass and 170 BPM electronic for the final sprint.",
    meta: "165–175 BPM",
    energy: 5,
    glow: "#8C7A4A",
    seeds: ["drum and bass sprint", "170 bpm electronic", "hardcore techno", "running drum and bass"],
    fallbackSeeds: ["breakbeat", "jungle dnb"],
  },
  {
    slug: "focus-nasheed",
    emoji: "🎧",
    title: "Focus & Nasheed",
    blurb: "Vocal-led nasheed and clean instrumentals for tunnel vision.",
    meta: "Steady / no lyrics",
    energy: 3,
    glow: "#A98A5B",
    seeds: ["nasheed", "arabic nasheed", "instrumental focus", "cinematic focus"],
    fallbackSeeds: ["oud instrumental", "ambient focus"],
  },
  {
    slug: "old-school-iron",
    emoji: "🏋️",
    title: "Old School Iron",
    blurb: "80s rock and classic gym anthems from the golden era.",
    meta: "Classic / 4×8",
    energy: 4,
    glow: "#B07A44",
    seeds: ["80s rock anthem", "classic rock gym", "rock training", "survivor eye of the tiger"],
    fallbackSeeds: ["hair metal", "stadium rock"],
  },
  {
    slug: "beast-speech",
    emoji: "🎙️",
    title: "Beast Mode Speech",
    blurb: "Motivational talks and gym speeches for the walk to the rack.",
    meta: "Spoken word",
    energy: 4,
    glow: "#8E6B4E",
    seeds: ["gym motivational speech", "workout motivation speech", "discipline motivation"],
    fallbackSeeds: ["athlete motivation", "mindset speech"],
  },
  {
    slug: "deep-house-cardio",
    emoji: "🌊",
    title: "Deep House Cardio",
    blurb: "Four-on-the-floor house for steady-state rows and bikes.",
    meta: "120–126 BPM",
    energy: 3,
    glow: "#7E7A5A",
    seeds: ["deep house cardio", "tech house workout", "house running mix", "melodic house"],
    fallbackSeeds: ["afro house", "progressive house"],
  },
  {
    slug: "late-night-grind",
    emoji: "🌙",
    title: "Late Night Grind",
    blurb: "Dark trap and night-drive synths for the 10pm session.",
    meta: "Low light / 808",
    energy: 3,
    glow: "#6E6455",
    seeds: ["dark trap", "night drive synthwave", "late night rap", "dark ambient trap"],
    fallbackSeeds: ["synthwave", "cloud rap"],
  },
  {
    slug: "morning-momentum",
    emoji: "☀️",
    title: "Morning Momentum",
    blurb: "Bright, upbeat energy for a 6am session before work.",
    meta: "Upbeat / wake-up",
    energy: 3,
    glow: "#C99A5B",
    seeds: ["morning workout upbeat", "feel good pop workout", "disco funk workout", "sunrise house"],
    fallbackSeeds: ["funk groove", "indie pop upbeat"],
  },
  {
    slug: "stretch-breathe",
    emoji: "🧘",
    title: "Stretch & Breathe",
    blurb: "Slow strings, meditation and mobility-flow calm.",
    meta: "60–70 BPM",
    energy: 1,
    glow: "#8A8A6E",
    seeds: ["stretching ambient", "meditation calm", "yoga piano", "mobility flow music"],
    fallbackSeeds: ["ambient drone", "soft piano"],
  },
  {
    slug: "cool-down",
    emoji: "🧊",
    title: "Cool Down",
    blurb: "Lo-fi, ambient and soft piano to bring the heart rate down.",
    meta: "Wind-down",
    energy: 1,
    glow: "#6F7C80",
    seeds: ["lofi cool down", "chill ambient", "soft piano relax", "lofi hip hop"],
    fallbackSeeds: ["downtempo", "chillhop"],
  },
];

export function getMood(slug: string): Mood | undefined {
  return MOODS.find((mood) => mood.slug === slug);
}

export const MOOD_SLUGS = MOODS.map((mood) => mood.slug);

/** Seed queries used to bootstrap a brand-new account with no history. */
export const STARTER_SEEDS = [
  "brazilian phonk",
  "gym motivation",
  "hard rock workout",
  "lofi cool down",
];
