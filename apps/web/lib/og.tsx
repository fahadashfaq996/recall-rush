import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ReactNode } from "react";

/** Brand display font for share images (Satori needs a TTF, not the woff2 next/font serves). */
export async function ogFonts() {
  const data = await readFile(join(process.cwd(), "assets/Unbounded-Black.ttf"));
  return [{ name: "Unbounded", data, weight: 900 as const, style: "normal" as const }];
}

/** Shared neon frame for generated share images. */
export function OgFrame({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "radial-gradient(circle at 50% 0%, #3b1f8f 0%, #0d0c2b 45%, #06061a 100%)",
        color: "white",
        fontFamily: "Unbounded, sans-serif",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 40,
          left: 56,
          display: "flex",
          fontSize: 34,
          fontWeight: 900,
          letterSpacing: -1,
        }}
      >
        RECALL<span style={{ color: "#ff2bd6" }}>RUSH</span>
      </div>
      {children}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 10,
          background: "linear-gradient(90deg, #22e6ff, #8b5cff, #ff2bd6)",
        }}
      />
    </div>
  );
}
