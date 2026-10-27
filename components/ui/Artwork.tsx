"use client";

import { Music2 } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

interface ArtworkProps {
  src: string | null | undefined;
  alt: string;
  size?: number;
  className?: string;
  rounded?: string;
}

/**
 * Artwork with a graceful gradient fallback — upstream catalogues sometimes
 * return 404s, and a broken-image icon in a player looks cheap.
 */
export function Artwork({
  src,
  alt,
  size = 48,
  className,
  rounded = "rounded-xl",
}: ArtworkProps) {
  const [failed, setFailed] = useState(false);
  const showFallback = !src || failed;

  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden bg-ink/[0.08]",
        rounded,
        className,
      )}
      style={{ width: size, height: size }}
    >
      {showFallback ? (
        <div
          className={cn(
            "grid h-full w-full place-items-center bg-gradient-to-br from-amber/25 via-ink/[0.06] to-ink/[0.14]",
          )}
        >
          <Music2
            className="text-ink/35"
            style={{ width: size * 0.36, height: size * 0.36 }}
            strokeWidth={1.8}
          />
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src ?? ""}
          alt={alt}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      )}
    </div>
  );
}
