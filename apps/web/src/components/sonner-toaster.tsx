"use client";

import { useEffect, useState } from "react";
import { Toaster } from "sonner";

export function SonnerToaster() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const update = () =>
      setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return <Toaster position="bottom-right" richColors closeButton theme={theme} />;
}
