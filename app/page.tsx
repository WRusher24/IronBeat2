import type { Metadata } from "next";

import { HomeView } from "@/components/home/HomeView";
import { requireUser } from "@/lib/auth";
import { listPlaylists, listRecentPlays, listRecentSearches, getLibraryStats } from "@/lib/data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Home",
};

export default async function HomePage() {
  const user = await requireUser("/");

  const [searches, plays, playlists, stats] = await Promise.all([
    listRecentSearches(user.id, 8),
    listRecentPlays(user.id, 10),
    listPlaylists(user.id),
    getLibraryStats(user.id),
  ]);

  return (
    <HomeView
      displayName={user.displayName}
      recentSearches={searches.map((search) => search.query)}
      recentPlays={plays}
      playlists={playlists.map((playlist) => ({
        id: playlist.id,
        name: playlist.name,
        trackCount: playlist.trackCount,
        accent: playlist.accent,
      }))}
      playCount={stats.playCount}
    />
  );
}
