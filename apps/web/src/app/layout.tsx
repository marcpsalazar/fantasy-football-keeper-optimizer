import type { Metadata, Viewport } from "next";
import { SonnerToaster } from "@/components/sonner-toaster";
import { PwaRegister } from "@/components/pwa-register";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mayhem | Fantasy Football Tools",
  description: "Fantasy football keeper optimizer and mock draft tool",
  icons: {
    icon: "/icon.svg",
    apple: "/pwa-icon/192",
  },
  appleWebApp: {
    capable: true,
    title: "Mayhem",
    statusBarStyle: "default",
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
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem("theme");if(t==="dark"||(t==null&&window.matchMedia("(prefers-color-scheme: dark)").matches)){document.documentElement.classList.add("dark")}})()`,
          }}
        />
      </head>
      <body>
        {children}
        <SonnerToaster />
        <PwaRegister />
      </body>
    </html>
  );
}
