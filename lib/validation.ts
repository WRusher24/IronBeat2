import { z } from "zod";

import { TRACK_PROVIDERS } from "@/lib/tracks";

const emailSchema = z
  .string()
  .trim()
  .min(3, "Email is required")
  .max(254, "Email is too long")
  .email("Enter a valid email address")
  .transform((value) => value.toLowerCase());

const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(128, "Password is too long");

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: z
    .string()
    .trim()
    .min(1, "Tell us what to call you")
    .max(40, "Keep it under 40 characters"),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required").max(128),
});

export const ACCENTS = ["amber", "ember", "moss", "ocean", "violet", "sand"] as const;

export const createPlaylistSchema = z.object({
  name: z.string().trim().min(1, "Name your playlist").max(60, "Keep it under 60 characters"),
  description: z.string().trim().max(200).optional().nullable(),
  accent: z.enum(ACCENTS).optional(),
});

export const updatePlaylistSchema = z
  .object({
    name: z.string().trim().min(1).max(60).optional(),
    description: z.string().trim().max(200).nullable().optional(),
    accent: z.enum(ACCENTS).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Nothing to update",
  });

/** Wire format for a track snapshot coming from search results. */
export const trackPayloadSchema = z.object({
  id: z.string().min(1).max(400).optional(),
  provider: z.enum(TRACK_PROVIDERS),
  providerId: z.string().min(1).max(400),
  title: z.string().min(1).max(300),
  artist: z.string().min(1).max(300),
  album: z.string().max(300).nullable().optional(),
  artwork: z.string().max(1200).nullable().optional(),
  duration: z.number().int().min(0).max(86_400).nullable().optional(),
  streamUrl: z.string().max(2000).nullable().optional(),
  externalUrl: z.string().max(2000).nullable().optional(),
  kind: z.enum(["audio", "video"]).default("audio"),
  isPreview: z.boolean().default(false),
});

export const addTrackSchema = z.object({
  track: trackPayloadSchema,
});

export const reorderSchema = z.object({
  trackId: z.string().min(1),
  direction: z.enum(["up", "down"]),
});

export const playRecordSchema = z.object({
  trackId: z.string().min(1).max(400),
  provider: z.enum(TRACK_PROVIDERS),
  title: z.string().min(1).max(300),
  artist: z.string().min(1).max(300),
  artwork: z.string().max(1200).nullable().optional(),
  contextLabel: z.string().max(120).nullable().optional(),
});

export const searchQuerySchema = z
  .string()
  .trim()
  .min(1, "Type something to search")
  .max(120, "That query is too long");

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type TrackPayload = z.infer<typeof trackPayloadSchema>;
