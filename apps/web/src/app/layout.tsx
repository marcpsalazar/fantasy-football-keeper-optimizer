import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Keeper Optimizer Dashboard",
  description: "Fantasy football keeper optimizer dashboard",
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
