import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";

import { getDb } from "@/db";
import { users } from "@/db/schema";
import { clientIp, isSameOrigin, jsonError, jsonOk, zodMessage } from "@/lib/api";
import { createSession, verifyPassword } from "@/lib/auth";
import { rateLimit, resetRateLimit } from "@/lib/rate-limit";
import { loginSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return jsonError("Cross-origin request rejected", 403);
  }

  const ip = clientIp(request);
  const ipLimit = rateLimit(`login-ip:${ip}`, 30, 15 * 60 * 1000);
  if (!ipLimit.ok) {
    return jsonError("Too many attempts. Please wait a moment.", 429, {
      retryAfter: ipLimit.retryAfterSeconds,
    });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Expected a JSON body", 400);
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(zodMessage(parsed.error), 422);
  }

  const { email, password } = parsed.data;

  const accountLimit = rateLimit(`login-account:${email}`, 10, 15 * 60 * 1000);
  if (!accountLimit.ok) {
    return jsonError("Too many attempts for this account. Try again later.", 429, {
      retryAfter: accountLimit.retryAfterSeconds,
    });
  }

  const db = getDb();
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      passwordHash: users.passwordHash,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  const account = rows[0];

  // Always run a comparison so response timing doesn't leak account existence.
  const validPassword = account
    ? await verifyPassword(password, account.passwordHash)
    : await verifyPassword(password, "$2a$11$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv");

  if (!account || !validPassword) {
    return jsonError("Email or password is incorrect.", 401);
  }

  resetRateLimit(`login-account:${email}`);
  await createSession(account.id);

  return jsonOk({
    user: {
      id: account.id,
      email: account.email,
      displayName: account.displayName,
      createdAt: account.createdAt,
    },
  });
}
