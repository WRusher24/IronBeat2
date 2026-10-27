import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PlaylistDetailView } from "@/components/playlists/PlaylistDetailView";
import { requireUser } from "@/lib/auth";
import { getPlaylist } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const user = await requireUser("/playlists");
  const { id } = await params;
  const playlist = await getPlaylist(user.id, id);

  return { title: playlist?.name ?? "Folder" };
}

export default async function PlaylistPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser("/playlists");
  const { id } = await params;
  const playlist = await getPlaylist(user.id, id);

  if (!playlist) notFound();

  return (
    <PlaylistDetailView
      playlist={{
        id: playlist.id,
        name: playlist.name,
        description: playlist.description,
        accent: playlist.accent,
        tracks: playlist.tracks,
      }}
    />
  );
}
