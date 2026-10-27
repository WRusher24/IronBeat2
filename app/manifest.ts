import type { MetadataRoute } from "next";

/**
 * Web App Manifest.
 *
 * `display: standalone` + `apple-mobile-web-app-capable` is what gives iPhone
 * users the fullscreen, chrome-less experience after "Add to Home Screen".
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "IronBeat — Workout Music",
    short_name: "IronBeat",
    description:
      "Instant workout music search, curated mood decks and smart shuffle — a private audio vault built for the gym floor.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "portrait",
    background_color: "#F5F2EC",
    theme_color: "#F5F2EC",
    categories: ["health", "fitness", "music", "entertainment"],
    lang: "en",
    dir: "ltr",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Search music",
        short_name: "Search",
        url: "/search",
        description: "Jump straight into instant search",
      },
      {
        name: "Moods & vibes",
        short_name: "Moods",
        url: "/?decks=1",
        description: "Launch a curated training vibe",
      },
      {
        name: "My folders",
        short_name: "Folders",
        url: "/playlists",
        description: "Open your training folders",
      },
    ],
  };
}
