import { ImageResponse } from "next/og";

export const runtime = "edge";

export function GET() {
  return new ImageResponse(<MayhemIcon size={192} />, { width: 192, height: 192 });
}

function MayhemIcon({ size }: { size: number }) {
  const r = Math.round(size * 0.1875); // ~18% rounded corners (maskable safe zone)
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: r,
        background: "#047857",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 64 64"
        width={size * 0.75}
        height={size * 0.75}
      >
        <path
          fill="#ffffff"
          d="M18 43c-3.9-8.7-.9-19.6 7.3-25.4 7.5-5.3 17.1-5.1 22.8.2 2.6 7.4-.8 16.4-8.3 21.7C33.1 44.2 24.7 45.4 18 43Z"
        />
        <path
          fill="none"
          stroke="#047857"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="4"
          d="M25 39 45 20M29 26l9 9M24 32l8 8M35 20l8 8"
        />
      </svg>
    </div>
  );
}
