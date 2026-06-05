import type { Metadata } from "next";
import { SonnerToaster } from "@/components/sonner-toaster";
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
      </body>
    </html>
  );
}
