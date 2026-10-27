"use client";

import { Heart, House, ListMusic, Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/", label: "Home", icon: House },
  { href: "/search", label: "Search", icon: Search },
  { href: "/playlists", label: "Folders", icon: ListMusic },
  { href: "/library", label: "Saved", icon: Heart },
];

export function BottomNav() {
  const pathname = usePathname();

  if (pathname === "/login" || pathname === "/register") return null;

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-ink/[0.07] bg-cream/90 backdrop-blur-xl"
    >
      <div className="safe-bottom mx-auto flex max-w-[520px] items-stretch justify-around px-3 pt-1.5">
        {ITEMS.map((item) => {
          const active =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex min-w-[64px] flex-col items-center gap-1 rounded-2xl px-3 py-1.5 transition-colors",
                active ? "text-ink" : "text-ink-muted hover:text-ink/80",
              )}
            >
              <Icon
                className={cn("h-[21px] w-[21px]", active && "text-amber-deep")}
                strokeWidth={active ? 2.4 : 1.9}
                fill={active && item.label === "Saved" ? "currentColor" : "none"}
              />
              <span
                className={cn(
                  "text-[10px] font-semibold tracking-[-0.01em]",
                  active ? "text-ink" : "text-ink-muted",
                )}
              >
                {item.label}
              </span>
              {active ? (
                <span className="absolute -top-[7px] h-[3px] w-6 rounded-full bg-amber" />
              ) : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
