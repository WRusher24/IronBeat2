import type { NextRequest } from "next/server";

import { isSameOrigin, jsonOk } from "@/lib/api";
import { destroySession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return jsonOk({ ok: false }, { status: 403 });
  }

  await destroySession();
  return jsonOk({ ok: true });
}
