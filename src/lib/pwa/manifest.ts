import type { MetadataRoute } from "next";

export const PWA_THEME_COLOR = "#0B1F3A";
export const PWA_BACKGROUND_COLOR = "#F3F4F6";
export const PWA_APP_NAME = "AI AutoTech / AIOS";
export const PWA_SHORT_NAME = "AIOS";
export const PWA_START_URL = "/command-centre";

/** Web app manifest for the command centre. No store listing is attached. */
export function aiosWebManifest(): MetadataRoute.Manifest {
  return {
    name: PWA_APP_NAME,
    short_name: PWA_SHORT_NAME,
    description: "AI AutoTech command centre (AIOS). Install from the phone browser. No store listing is live.",
    id: PWA_START_URL,
    start_url: PWA_START_URL,
    scope: "/",
    display: "standalone",
    background_color: PWA_BACKGROUND_COLOR,
    theme_color: PWA_THEME_COLOR,
    lang: "en-ZA",
    categories: ["business"],
    prefer_related_applications: false,
    icons: [
      { src: "/icons/aios-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/aios-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/aios-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icons/aios.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
