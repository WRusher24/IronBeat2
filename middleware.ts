import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "ironbeat_session";

const PUBLIC_PATHS = ["/login", "/register", "/offline"];

/**
 * Edge guard.
 *
 * This only checks that a session cookie *exists* — it deliberately does not
 * hit the database (that would put a Neon round-trip on every asset request).
 * Real verification happens in `getSessionUser()` inside pages and route
 * handlers, which redirect/401 if the session is expired or forged.
 */
export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

  const isPublic = PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );

  if (!hasSession && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  if (hasSession && (pathname === "/login" || pathname === "/register")) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Run on everything except static assets, the service worker, the web
     * manifest and API routes (API routes enforce auth themselves and must be
     * able to return JSON 401s rather than HTML redirects).
     */
    "/((?!api|_next/static|_next/image|icons|sw.js|manifest.webmanifest|favicon.ico|robots.txt).*)",
  ],
};
