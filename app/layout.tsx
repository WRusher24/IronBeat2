import type { Metadata, Viewport } from "next";
import { Instrument_Serif, Inter } from "next/font/google";

import "./globals.css";

import { BottomNav } from "@/components/layout/BottomNav";
import { MiniPlayer } from "@/components/player/MiniPlayer";
import { FavoritesProvider } from "@/components/providers/FavoritesProvider";
import { PlayerProvider } from "@/components/providers/PlayerProvider";
import { ToastProvider } from "@/components/providers/ToastProvider";
import { ServiceWorkerRegistrar } from "@/components/pwa/ServiceWorkerRegistrar";
import { getSessionUser } from "@/lib/auth";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-display",
  display: "swap",
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "IronBeat — Train to your own sound",
    template: "%s · IronBeat",
  },
  description:
    "A private, mobile-first workout music vault. Instant search across open audio sources, curated mood decks, smart shuffle and lock-screen controls — built for the gym floor.",
  applicationName: "IronBeat",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "IronBeat",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false, email: false, address: false },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  openGraph: {
    title: "IronBeat",
    description:
      "Instant workout music search, mood decks and smart shuffle in a private mobile PWA.",
    type: "website",
    images: ["/icons/icon-512.png"],
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#F5F2EC",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "light",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getSessionUser();

  return (
    <html lang="en" className={`${inter.variable} ${instrumentSerif.variable}`}>
      <body className="font-sans">
        <PlayerProvider authenticated={Boolean(user)}>
          <ToastProvider>
            <FavoritesProvider authenticated={Boolean(user)}>
              <div className="app-shell pb-[196px]">{children}</div>
              <MiniPlayer />
              <BottomNav />
            </FavoritesProvider>
          </ToastProvider>
        </PlayerProvider>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
