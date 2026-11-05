import { ImageResponse } from "next/og";
import { OgFrame, ogFonts } from "@/lib/og";

export const alt = "Recall Rush: the endless memory game";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    <OgFrame>
      <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: 8, color: "#9296c9" }}>ENDLESS MEMORY GAME</div>
      <div
        style={{
          fontSize: 112,
          fontWeight: 900,
          lineHeight: 1,
          marginTop: 20,
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <span>How far can your</span>
        <span style={{ color: "#22e6ff", textShadow: "0 0 30px #22e6ff" }}>memory go?</span>
      </div>
      <div style={{ fontSize: 30, marginTop: 30, color: "#d6d8ff" }}>New rule every round · One wrong tap ends it</div>
    </OgFrame>,
    { ...size, fonts: await ogFonts() },
  );
}
