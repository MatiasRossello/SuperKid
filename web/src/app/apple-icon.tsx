import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(180deg,#2A0F4A,#8A1F6B 50%,#FF4F7B 80%,#FF9A3C)" }}>
        <div style={{ fontSize: 92, fontWeight: 900, color: "#FFF4E8", textShadow: "5px 5px 0 #FF2E88", display: "flex" }}>
          S<span style={{ color: "#FFC94B" }}>K</span>
        </div>
      </div>
    ),
    size,
  );
}
