import type { Metadata, Viewport } from "next";
import { SonnerToaster } from "@/components/sonner-toaster";
import { PwaRegister } from "@/components/pwa-register";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mayhem | Fantasy Football Tools",
  description: "Fantasy football keeper optimizer and mock draft tool",
  icons: {
    icon: "/brand/icon-football.png",
    apple: "/brand/icon-football.png",
  },
  appleWebApp: {
    capable: true,
    title: "Mayhem",
    statusBarStyle: "black-translucent",
  },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        {/* Google Fonts preconnect */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>
        {children}
        <SonnerToaster />
        <PwaRegister />
      </body>
    </html>
  );
}
