import type { Metadata } from "next";

import { SearchPageView } from "@/components/search/SearchPageView";
import { requireUser } from "@/lib/auth";
import { listRecentSearches } from "@/lib/data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Search",
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await requireUser("/search");
  const params = await searchParams;
  const searches = await listRecentSearches(user.id, 8);

  return (
    <SearchPageView
      initialQuery={typeof params.q === "string" ? params.q.slice(0, 120) : ""}
      recentSearches={searches.map((search) => search.query)}
    />
  );
}
