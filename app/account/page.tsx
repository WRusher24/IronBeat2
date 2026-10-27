import type { Metadata } from "next";

import { AccountView } from "@/components/account/AccountView";
import { requireUser } from "@/lib/auth";
import { getLibraryStats } from "@/lib/data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Account",
};

export default async function AccountPage() {
  const user = await requireUser("/account");
  const stats = await getLibraryStats(user.id);

  return (
    <AccountView
      displayName={user.displayName}
      email={user.email}
      joinedAt={user.createdAt.toISOString()}
      stats={stats}
    />
  );
}
