import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Recall Rush: the endless memory game",
    short_name: "Recall Rush",
    description: "Endless memory, focus and reaction rounds. One wrong tap ends the run.",
    start_url: "/play",
    display: "standalone",
    orientation: "portrait",
    background_color: "#06061a",
    theme_color: "#06061a",
    icons: [{ src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" }],
  };
}
