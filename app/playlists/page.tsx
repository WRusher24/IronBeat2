import type { Metadata } from "next";

import { PlaylistsView } from "@/components/playlists/PlaylistsView";
import { requireUser } from "@/lib/auth";
import { listPlaylists } from "@/lib/data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Playlists",
};

export default async function PlaylistsPage() {
  const user = await requireUser("/playlists");
  const playlists = await listPlaylists(user.id);

  return (
    <PlaylistsView
      initialPlaylists={playlists.map((playlist) => ({
        id: playlist.id,
        name: playlist.name,
        description: playlist.description,
        accent: playlist.accent,
        trackCount: playlist.trackCount,
      }))}
    />
  );
}
