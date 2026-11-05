import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #22e6ff, #8b5cff 50%, #ff2bd6)",
        borderRadius: 112,
      }}
    >
      <div
        style={{
          width: 440,
          height: 440,
          borderRadius: 92,
          background: "#06061a",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          fontSize: 300,
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
