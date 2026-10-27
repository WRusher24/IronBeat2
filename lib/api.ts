import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ZodError } from "zod";

export function jsonOk<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(data, {
    ...init,
    headers: {
      "Cache-Control": "no-store",
      ...(init?.headers ?? {}),
    },
  });
}

export function jsonError(
  message: string,
  status = 400,
  extra?: Record<string, unknown>,
): NextResponse {
  return NextResponse.json(
    { error: message, ...extra },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

/** Extracts the first human-readable message from a Zod failure. */
export function zodMessage(error: ZodError): string {
  const first = error.issues[0];
  return first?.message ?? "Invalid request";
}

/**
 * Best-effort client identity for rate limiting.
 * Vercel sets `x-forwarded-for`; we take the left-most entry.
 */
export function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}

/**
 * CSRF defence in depth.
 *
 * Session cookies are SameSite=Lax (so cross-site POSTs never carry them);
 * this additionally rejects mutating requests whose Origin doesn't match the
 * host we're serving. Requests without an Origin header (server-to-server,
 * curl, native apps) are allowed through.
 */
export function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  const host = request.headers.get("host");
  if (!host) return false;

  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function requireJson(request: NextRequest): boolean {
  const contentType = request.headers.get("content-type") ?? "";
  return contentType.includes("application/json");
}

/**
 * Extracts a Postgres SQLSTATE from a (possibly wrapped) driver error.
 *
 * Drizzle wraps driver failures in `DrizzleQueryError`, so `error.code` is
 * undefined while `error.cause.code` holds the real SQLSTATE.
 */
export function pgErrorCode(error: unknown): string | null {
  let current: unknown = error;

  for (let depth = 0; depth < 4 && current; depth += 1) {
    if (typeof current === "object" && current !== null && "code" in current) {
      const code = (current as { code?: unknown }).code;
      if (typeof code === "string" && /^[0-9A-Z]{5}$/.test(code)) return code;
    }
    current = (current as { cause?: unknown }).cause;
  }

  return null;
}

/** Postgres unique_violation. */
export const PG_UNIQUE_VIOLATION = "23505";
