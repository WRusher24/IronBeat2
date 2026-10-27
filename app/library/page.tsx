import type { Metadata } from "next";

import { LibraryView } from "@/components/library/LibraryView";
import { requireUser } from "@/lib/auth";
import { listFavorites, listRecentPlays } from "@/lib/data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Saved",
};

export default async function LibraryPage() {
  const user = await requireUser("/library");

  const [favorites, recent] = await Promise.all([
    listFavorites(user.id),
    listRecentPlays(user.id, 30),
  ]);

  return <LibraryView favorites={favorites} recent={recent} />;
}
