import type { NextRequest } from "next/server";

import { getDb } from "@/db";
import { users } from "@/db/schema";
import { clientIp, isSameOrigin, jsonError, jsonOk, pgErrorCode, PG_UNIQUE_VIOLATION, zodMessage } from "@/lib/api";
import { createSession, hashPassword } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { registerSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return jsonError("Cross-origin request rejected", 403);
  }

  if (process.env.SIGNUPS_DISABLED === "true") {
    return jsonError("New signups are currently closed.", 403);
  }

  const limit = rateLimit(`register:${clientIp(request)}`, 8, 60 * 60 * 1000);
  if (!limit.ok) {
    return jsonError("Too many sign-up attempts. Try again shortly.", 429, {
      retryAfter: limit.retryAfterSeconds,
    });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Expected a JSON body", 400);
  }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(zodMessage(parsed.error), 422);
  }

  const { email, password, displayName } = parsed.data;
  const db = getDb();

  try {
    const passwordHash = await hashPassword(password);

    const inserted = await db
      .insert(users)
      .values({ email, passwordHash, displayName })
      .returning({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        createdAt: users.createdAt,
      });

    const user = inserted[0];
    await createSession(user.id);

    return jsonOk({ user }, { status: 201 });
  } catch (error) {
    // Postgres unique_violation — the email is already taken.
    if (pgErrorCode(error) === PG_UNIQUE_VIOLATION) {
      return jsonError("An account with this email already exists.", 409);
    }

    console.error("[register] failed", error);
    return jsonError("Could not create your account. Please try again.", 500);
  }
}
