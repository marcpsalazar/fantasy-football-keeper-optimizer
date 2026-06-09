import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Mayhem | Fantasy Football Tools",
    short_name: "Mayhem",
    description: "Fantasy football keeper optimizer and mock draft tool",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f5f1",
    theme_color: "#047857",
    orientation: "portrait-primary",
    categories: ["sports", "utilities"],
    icons: [
      {
        src: "/pwa-icon/192",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/pwa-icon/512",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
