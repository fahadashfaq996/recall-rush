import { progressBar } from "@recall/engine";
import { ImageResponse } from "next/og";
import { OgFrame, ogFonts } from "@/lib/og";
import { getStore } from "@/lib/server/store";

export const alt = "A Recall Rush run";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  const run = /^[0-9a-f-]{36}$/i.test(runId)
    ? await getStore()
        .getRun(runId)
        .catch(() => null)
    : null;
  return new ImageResponse(
    <OgFrame>
      {run ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ fontSize: 44, fontWeight: 900, color: "#ff2bd6", display: "flex" }}>{run.nickname}</div>
          <div style={{ display: "flex", fontSize: 28, letterSpacing: 8, color: "#9296c9", marginTop: 10 }}>REACHED ROUND</div>
          <div style={{ display: "flex", fontSize: 240, fontWeight: 900, lineHeight: 1, color: "#d9fbff", textShadow: "0 0 40px #22e6ff" }}>
            {run.rounds}
          </div>
          <div style={{ fontSize: 44, marginTop: 6, display: "flex" }}>{progressBar(run.rounds).replace(/➕/g, "+")}</div>
          <div style={{ display: "flex", fontSize: 30, marginTop: 18, color: "#d6d8ff" }}>Can you beat it?</div>
        </div>
      ) : (
        <div style={{ display: "flex", fontSize: 90, fontWeight: 900 }}>How far can you go?</div>
      )}
    </OgFrame>,
    { ...size, fonts: await ogFonts() },
  );
}
