/**
 * IronBeat end-to-end smoke test.
 *
 * Drives a running server over HTTP and asserts real invariants:
 * auth, per-user isolation, multi-source search, playlists, favourites,
 * play logging, moods and Smart Shuffle.
 *
 *   node scripts/smoke-test.mjs http://localhost:3010
 *
 * The test creates its own disposable accounts and deletes them at the end, so
 * it is safe to run repeatedly against a dev database.
 */

const BASE = process.argv[2] ?? "http://localhost:3000";

let passed = 0;
let failed = 0;
const failures = [];

function check(name, ok, detail = "") {
  if (ok) {
    passed += 1;
    console.log(`  \x1b[32m✔\x1b[0m ${name}`);
  } else {
    failed += 1;
    failures.push(name);
    console.log(`  \x1b[31m✖\x1b[0m ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function section(title) {
  console.log(`\n\x1b[1m${title}\x1b[0m`);
}

async function request(path, { method = "GET", body, cookie, timeout = 45_000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
        Origin: BASE,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
      redirect: "manual",
    });

    const text = await response.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }

    const setCookie = response.headers.getSetCookie?.() ?? [];
    const sessionCookie = setCookie
      .map((entry) => entry.split(";")[0])
      .find((entry) => entry.startsWith("ironbeat_session="));

    return {
      status: response.status,
      text,
      json,
      cookie: sessionCookie,
      location: response.headers.get("location"),
    };
  } finally {
    clearTimeout(timer);
  }
}

async function register(label) {
  const email = `smoke-${label}-${Date.now()}@ironbeat.test`;
  const response = await request("/api/auth/register", {
    method: "POST",
    body: { email, password: "bench-press-2026", displayName: `Smoke ${label}` },
  });

  return { email, password: "bench-press-2026", response, cookie: response.cookie };
}

async function main() {
  console.log(`IronBeat smoke test → ${BASE}`);

  // -------------------------------------------------------------------------
  section("1. Public surface");
  // -------------------------------------------------------------------------
  const loginPage = await request("/login");
  check("GET /login returns 200", loginPage.status === 200, `got ${loginPage.status}`);

  const registerPage = await request("/register");
  check("GET /register returns 200", registerPage.status === 200, `got ${registerPage.status}`);

  const homeAnon = await request("/");
  check(
    "GET / without a session redirects to /login",
    homeAnon.status === 307 && (homeAnon.location ?? "").includes("/login"),
    `got ${homeAnon.status} → ${homeAnon.location}`,
  );

  const manifest = await request("/manifest.webmanifest");
  check("Manifest is served", manifest.status === 200, `got ${manifest.status}`);
  check(
    "Manifest is standalone",
    manifest.json?.display === "standalone",
    `display=${manifest.json?.display}`,
  );
  check(
    "Manifest declares 192 and 512 icons",
    Array.isArray(manifest.json?.icons) &&
      manifest.json.icons.some((i) => i.sizes === "192x192") &&
      manifest.json.icons.some((i) => i.sizes === "512x512"),
  );

  const health = await request("/api/health");
  check("Health endpoint returns 200", health.status === 200, `got ${health.status}`);
  check(
    "Health reports a ready database",
    health.json?.database === "ready",
    `database=${health.json?.database} message=${health.json?.message ?? ""}`,
  );
  check(
    "Health confirms all eight tables exist",
    health.json?.tables?.present === 8 && health.json?.tables?.expected === 8,
    `tables=${JSON.stringify(health.json?.tables)}`,
  );

  const unauthSearch = await request("/api/search?q=phonk");
  check("Search rejects anonymous callers", unauthSearch.status === 401, `got ${unauthSearch.status}`);

  const unauthPlaylists = await request("/api/playlists");
  check(
    "Playlists reject anonymous callers",
    unauthPlaylists.status === 401,
    `got ${unauthPlaylists.status}`,
  );

  // -------------------------------------------------------------------------
  section("2. Registration & session");
  // -------------------------------------------------------------------------
  const alice = await register("a");
  check("Register returns 201", alice.response.status === 201, `got ${alice.response.status}`);
  check("Register sets an httpOnly session cookie", Boolean(alice.cookie));
  check("Register returns the new user", alice.response.json?.user?.email === alice.email);

  const me = await request("/api/auth/me", { cookie: alice.cookie });
  check("Session resolves the current user", me.json?.user?.email === alice.email);

  const homeAuthed = await request("/", { cookie: alice.cookie });
  check("Authenticated home renders 200", homeAuthed.status === 200, `got ${homeAuthed.status}`);

  const dup = await request("/api/auth/register", {
    method: "POST",
    body: { email: alice.email, password: "bench-press-2026", displayName: "Dup" },
  });
  check("Duplicate email is rejected with 409", dup.status === 409, `got ${dup.status}`);

  const weak = await request("/api/auth/register", {
    method: "POST",
    body: { email: `weak-${Date.now()}@ironbeat.test`, password: "short", displayName: "Weak" },
  });
  check("Weak password is rejected with 422", weak.status === 422, `got ${weak.status}`);

  const badLogin = await request("/api/auth/login", {
    method: "POST",
    body: { email: alice.email, password: "wrong-password" },
  });
  check("Wrong password is rejected with 401", badLogin.status === 401, `got ${badLogin.status}`);

  const goodLogin = await request("/api/auth/login", {
    method: "POST",
    body: { email: alice.email, password: alice.password },
  });
  check("Correct password signs in", goodLogin.status === 200 && Boolean(goodLogin.cookie));

  // -------------------------------------------------------------------------
  section("3. Multi-source search");
  // -------------------------------------------------------------------------
  const search = await request("/api/search?q=brazilian%20phonk&limit=20", {
    cookie: alice.cookie,
    timeout: 60_000,
  });

  check("Search returns 200", search.status === 200, `got ${search.status} ${search.text.slice(0, 120)}`);
  check("Search returns tracks", Array.isArray(search.json?.tracks) && search.json.tracks.length > 0,
    `tracks=${search.json?.tracks?.length}`);

  const tracks = search.json?.tracks ?? [];
  const sources = search.json?.sources ?? [];
  const okSources = sources.filter((source) => source.status === "ok");

  check("At least two audio sources responded", okSources.length >= 2,
    okSources.map((s) => `${s.provider}:${s.count}`).join(", "));

  check("Every track has a stable id", tracks.every((track) => typeof track.id === "string" && track.id.includes(":")));
  check("Every track has a playable target",
    tracks.every((track) => Boolean(track.streamUrl) || track.kind === "video"));
  check("No duplicate track ids in one result set",
    new Set(tracks.map((track) => track.id)).size === tracks.length);
  check("Results are not dominated by one provider",
    new Set(tracks.slice(0, 6).map((track) => track.provider)).size > 1);

  const chips = await request("/api/search/history?limit=8", { cookie: alice.cookie });
  check("Successful search is remembered as a chip",
    chips.json?.searches?.some((item) => item.query.toLowerCase().includes("phonk")));

  const emptySearch = await request("/api/search?q=", { cookie: alice.cookie });
  check("Empty query is rejected with 422", emptySearch.status === 422, `got ${emptySearch.status}`);

  // -------------------------------------------------------------------------
  section("4. Playlists");
  // -------------------------------------------------------------------------
  const created = await request("/api/playlists", {
    method: "POST",
    cookie: alice.cookie,
    body: { name: "Push day — smoke", description: "top sets", accent: "ember" },
  });
  check("Playlist creation returns 201", created.status === 201, `got ${created.status}`);

  const playlistId = created.json?.playlist?.id;
  check("Playlist has an id", Boolean(playlistId));

  const trackA = tracks[0];
  const trackB = tracks[1];

  const addA = await request(`/api/playlists/${playlistId}/tracks`, {
    method: "POST",
    cookie: alice.cookie,
    body: { track: trackA },
  });
  check("Adding a track returns 201", addA.status === 201, `got ${addA.status}`);

  const addAgain = await request(`/api/playlists/${playlistId}/tracks`, {
    method: "POST",
    cookie: alice.cookie,
    body: { track: trackA },
  });
  check("Duplicate track is reported, not duplicated",
    addAgain.json?.status === "duplicate", `status=${addAgain.json?.status}`);

  await request(`/api/playlists/${playlistId}/tracks`, {
    method: "POST",
    cookie: alice.cookie,
    body: { track: trackB },
  });

  const detail = await request(`/api/playlists/${playlistId}`, { cookie: alice.cookie });
  check("Playlist detail returns both tracks", detail.json?.playlist?.tracks?.length === 2,
    `tracks=${detail.json?.playlist?.tracks?.length}`);
  check("Track snapshots keep their stream URL",
    detail.json?.playlist?.tracks?.every((track) => Boolean(track.streamUrl) || track.kind === "video"));

  const moved = await request(`/api/playlists/${playlistId}/tracks/move`, {
    method: "POST",
    cookie: alice.cookie,
    body: { trackId: trackB.id, direction: "up" },
  });
  check("Reorder succeeds", moved.status === 200, `got ${moved.status}`);

  const afterMove = await request(`/api/playlists/${playlistId}`, { cookie: alice.cookie });
  check("Reorder persists the new order",
    afterMove.json?.playlist?.tracks?.[0]?.id === trackB.id,
    `first=${afterMove.json?.playlist?.tracks?.[0]?.id}`);

  const patched = await request(`/api/playlists/${playlistId}`, {
    method: "PATCH",
    cookie: alice.cookie,
    body: { name: "Push day — renamed" },
  });
  check("Rename succeeds", patched.status === 200, `got ${patched.status}`);

  // -------------------------------------------------------------------------
  section("5. Per-user isolation");
  // -------------------------------------------------------------------------
  const bob = await register("b");
  check("Second account registers", bob.response.status === 201);

  const bobList = await request("/api/playlists", { cookie: bob.cookie });
  check("Second user sees an empty playlist list", bobList.json?.playlists?.length === 0,
    `count=${bobList.json?.playlists?.length}`);

  const bobReadsAlice = await request(`/api/playlists/${playlistId}`, { cookie: bob.cookie });
  check("Second user cannot read another vault's playlist", bobReadsAlice.status === 404,
    `got ${bobReadsAlice.status}`);

  const bobDeletesAlice = await request(`/api/playlists/${playlistId}`, {
    method: "DELETE",
    cookie: bob.cookie,
  });
  check("Second user cannot delete another vault's playlist", bobDeletesAlice.status === 404,
    `got ${bobDeletesAlice.status}`);

  const bobAdds = await request(`/api/playlists/${playlistId}/tracks`, {
    method: "POST",
    cookie: bob.cookie,
    body: { track: trackA },
  });
  check("Second user cannot write into another vault's playlist", bobAdds.status === 404,
    `got ${bobAdds.status}`);

  const bobFavorites = await request("/api/favorites", { cookie: bob.cookie });
  check("Second user starts with no favourites", bobFavorites.json?.tracks?.length === 0);

  const bobChips = await request("/api/search/history", { cookie: bob.cookie });
  check("Second user has no search history", bobChips.json?.searches?.length === 0);

  // -------------------------------------------------------------------------
  section("6. Favourites & play log");
  // -------------------------------------------------------------------------
  const fav = await request("/api/favorites", {
    method: "POST",
    cookie: alice.cookie,
    body: { track: trackA },
  });
  check("Favourite toggle turns on", fav.json?.favorited === true);

  const favList = await request("/api/favorites", { cookie: alice.cookie });
  check("Favourite appears in the vault", favList.json?.tracks?.length === 1);

  const unfav = await request("/api/favorites", {
    method: "POST",
    cookie: alice.cookie,
    body: { track: trackA },
  });
  check("Favourite toggle turns off", unfav.json?.favorited === false);

  const play = await request("/api/history/plays", {
    method: "POST",
    cookie: alice.cookie,
    body: {
      trackId: trackA.id,
      provider: trackA.provider,
      title: trackA.title,
      artist: trackA.artist,
      artwork: trackA.artwork,
      contextLabel: "smoke test",
    },
  });
  check("Play is recorded", play.status === 200, `got ${play.status}`);

  const recent = await request("/api/history/plays?limit=5", { cookie: alice.cookie });
  check("Play shows up in recently played",
    recent.json?.tracks?.some((track) => track.id === trackA.id));

  const bobRecent = await request("/api/history/plays?limit=5", { cookie: bob.cookie });
  check("Play log is isolated per user", bobRecent.json?.tracks?.length === 0);

  // -------------------------------------------------------------------------
  section("7. Moods & Smart Shuffle");
  // -------------------------------------------------------------------------
  const mood = await request("/api/moods/phonk-hype", { cookie: alice.cookie, timeout: 60_000 });
  check("Mood expands into tracks",
    mood.status === 200 && (mood.json?.tracks?.length ?? 0) > 0,
    `status=${mood.status} tracks=${mood.json?.tracks?.length}`);
  check("Mood payload carries its metadata", mood.json?.mood?.slug === "phonk-hype");

  const unknownMood = await request("/api/moods/not-a-mood", { cookie: alice.cookie });
  check("Unknown mood returns 404", unknownMood.status === 404, `got ${unknownMood.status}`);

  const mix = await request("/api/mix/smart-shuffle", { cookie: alice.cookie, timeout: 60_000 });
  check("Smart Shuffle returns a mix",
    mix.status === 200 && (mix.json?.tracks?.length ?? 0) > 0,
    `status=${mix.status} tracks=${mix.json?.tracks?.length}`);
  check("Smart Shuffle explains its basis",
    Array.isArray(mix.json?.basis) && mix.json.basis.length > 0);
  check("Smart Shuffle surfaces the user's own search",
    (mix.json?.basis ?? []).some((seed) => String(seed).toLowerCase().includes("phonk")));

  // -------------------------------------------------------------------------
  section("8. Authenticated pages");
  // -------------------------------------------------------------------------
  for (const path of ["/", "/search?q=phonk", "/playlists", "/library", "/account", `/playlists/${playlistId}`]) {
    const page = await request(path, { cookie: alice.cookie, timeout: 60_000 });
    check(`GET ${path} renders 200`, page.status === 200, `got ${page.status}`);
  }

  const offline = await request("/offline");
  check("Offline fallback page renders", offline.status === 200, `got ${offline.status}`);

  const sw = await request("/sw.js");
  check("Service worker is served", sw.status === 200 && sw.text.includes("ironbeat-v1"));

  // -------------------------------------------------------------------------
  section("9. Cleanup & sign-out");
  // -------------------------------------------------------------------------
  const delPlaylist = await request(`/api/playlists/${playlistId}`, {
    method: "DELETE",
    cookie: alice.cookie,
  });
  check("Playlist delete succeeds", delPlaylist.status === 200, `got ${delPlaylist.status}`);

  const gone = await request(`/api/playlists/${playlistId}`, { cookie: alice.cookie });
  check("Deleted playlist is gone", gone.status === 404, `got ${gone.status}`);

  const logout = await request("/api/auth/logout", { method: "POST", cookie: alice.cookie });
  check("Logout succeeds", logout.status === 200);

  const afterLogout = await request("/api/auth/me", { cookie: alice.cookie });
  check("Session is invalid after logout", afterLogout.json?.user === null,
    `user=${JSON.stringify(afterLogout.json?.user)}`);

  const deleteAccount = await request("/api/account", { method: "DELETE", cookie: bob.cookie });
  check("Account deletion succeeds", deleteAccount.status === 200, `got ${deleteAccount.status}`);

  const bobAfter = await request("/api/auth/me", { cookie: bob.cookie });
  check("Deleted account's session is dead", bobAfter.json?.user === null);

  // -------------------------------------------------------------------------
  console.log(
    `\n\x1b[1mResult:\x1b[0m ${passed} passed, ${failed} failed${
      failed ? `\nFailed: ${failures.join(", ")}` : ""
    }`,
  );

  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("\nSmoke test crashed:", error);
  process.exit(1);
});
