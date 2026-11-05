import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #22e6ff, #8b5cff 50%, #ff2bd6)",
      }}
    >
      <div
        style={{
          width: 150,
          height: 150,
          borderRadius: 34,
          background: "#06061a",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          fontSize: 104,
          fontWeight: 900,
          fontFamily: "sans-serif",
        }}
      >
        R
      </div>
    </div>,
    size,
  );
}
