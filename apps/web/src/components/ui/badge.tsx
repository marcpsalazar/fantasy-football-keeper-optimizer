import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        default:
          "border-zinc-300 bg-zinc-100 text-zinc-800 dark:border-[#1a3050] dark:bg-[#0a2040] dark:text-[#BDC8D3]",
        success:
          "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-[rgba(255,179,64,0.3)] dark:bg-[rgba(255,179,64,0.08)] dark:text-[#FFB340]",
        warning:
          "border-amber-200 bg-amber-50 text-amber-800 dark:border-[rgba(255,179,64,0.3)] dark:bg-[rgba(255,179,64,0.08)] dark:text-[#FFB340]",
        danger:
          "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-400",
        info:
          "border-sky-200 bg-sky-50 text-sky-800 dark:border-[rgba(128,232,255,0.3)] dark:bg-[rgba(128,232,255,0.08)] dark:text-[#80E8FF]",
        qb:
          "border-amber-300 bg-amber-100 text-amber-900 font-semibold dark:border-[rgba(255,179,64,0.4)] dark:bg-[rgba(255,179,64,0.12)] dark:text-[#FFB340]",
        rb:
          "border-emerald-300 bg-emerald-100 text-emerald-900 font-semibold dark:border-[rgba(128,232,255,0.3)] dark:bg-[rgba(128,232,255,0.08)] dark:text-[#80E8FF]",
        wr:
          "border-sky-300 bg-sky-100 text-sky-900 font-semibold dark:border-[rgba(128,232,255,0.3)] dark:bg-[rgba(128,232,255,0.08)] dark:text-[#80E8FF]",
        te:
          "border-violet-300 bg-violet-100 text-violet-900 font-semibold dark:border-violet-700 dark:bg-violet-900/20 dark:text-violet-300",
        k:
          "border-zinc-300 bg-zinc-100 text-zinc-600 font-semibold dark:border-[#1a3050] dark:bg-[#0a2040] dark:text-[#BDC8D3]",
        dst:
          "border-zinc-300 bg-zinc-100 text-zinc-600 font-semibold dark:border-[#1a3050] dark:bg-[#0a2040] dark:text-[#BDC8D3]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof badgeVariants>;

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
