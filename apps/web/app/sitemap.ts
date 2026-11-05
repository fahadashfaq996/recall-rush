import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return ["", "/play", "/daily", "/leaderboard"].map((path) => ({
    url: `${base}${path}`,
    changeFrequency: "daily",
    priority: path === "" ? 1 : 0.8,
  }));
}
