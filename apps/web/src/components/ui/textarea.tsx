import * as React from "react";

import { cn } from "@/lib/utils";

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-32 w-full resize-y rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 shadow-sm outline-none transition-colors placeholder:text-zinc-400 focus:border-[#FFB340] focus:ring-2 focus:ring-[rgba(255,179,64,0.15)] disabled:cursor-not-allowed disabled:bg-zinc-100 dark:border-[#1a3050] dark:bg-[#040E1B] dark:text-[#EBF4F9] dark:placeholder:text-[#8fa4b3] dark:focus:border-[#80E8FF] dark:focus:ring-[rgba(128,232,255,0.12)] dark:disabled:bg-[#071829]",
        className,
      )}
      {...props}
    />
  );
}
