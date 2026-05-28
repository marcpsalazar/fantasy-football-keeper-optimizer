import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mayhem | Fantasy Football Tools",
  description: "Fantasy football tools",
  icons: {
    icon: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
