import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Cornerstock",
    short_name: "Cornerstock",
    description: "Bowling ball stock for Bowlers Corner.",
    start_url: "/",
    display: "standalone",
    // Android makes the startup screen from this color, the icon, and the name. Navy matches the iOS startup images.
    background_color: "#172a3a",
    theme_color: "#172a3a",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
