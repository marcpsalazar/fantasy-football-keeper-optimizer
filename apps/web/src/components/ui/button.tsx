import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex h-9 min-h-[44px] items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFB340] disabled:pointer-events-none disabled:opacity-50 sm:min-h-0",
  {
    variants: {
      variant: {
        // Primary: steel blue — main actions
        default:
          "bg-[#1C4D93] text-[#EBF4F9] font-semibold hover:bg-[#2563C4] hover:text-[#EBF4F9] dark:bg-[#1C4D93] dark:text-[#EBF4F9] dark:hover:bg-[#2563C4] dark:hover:text-[#EBF4F9]",
        // Secondary: neon blue — secondary actions
        secondary:
          "bg-[rgba(128,232,255,0.12)] text-[#80E8FF] border border-[rgba(128,232,255,0.3)] hover:bg-[rgba(128,232,255,0.2)] dark:bg-[rgba(128,232,255,0.1)] dark:text-[#80E8FF] dark:border-[rgba(128,232,255,0.25)] dark:hover:bg-[rgba(128,232,255,0.18)]",
        // Outline: subtle steel border — tertiary actions
        outline:
          "border border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-50 dark:border-[#1a3050] dark:bg-transparent dark:text-[#BDC8D3] dark:hover:bg-[rgba(128,232,255,0.06)] dark:hover:text-[#EBF4F9]",
        // Ghost: no border
        ghost:
          "text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950 dark:text-[#BDC8D3] dark:hover:bg-[rgba(128,232,255,0.06)] dark:hover:text-[#EBF4F9]",
        // Destructive: rose — unchanged
        destructive: "bg-rose-600 text-white hover:bg-rose-700",
      },
      size: {
        default: "h-9 px-3",
        sm: "h-8 px-2.5 text-xs",
        icon: "size-9 px-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
