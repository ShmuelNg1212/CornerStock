import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Cornerstock",
    short_name: "Cornerstock",
    description: "Bowling ball stock for Bowlers Corner.",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f3ec",
    theme_color: "#172a3a",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
