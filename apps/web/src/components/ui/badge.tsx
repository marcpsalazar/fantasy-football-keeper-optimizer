import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        default: "border-zinc-300 bg-zinc-100 text-zinc-800",
        success: "border-emerald-200 bg-emerald-50 text-emerald-800",
        warning: "border-amber-200 bg-amber-50 text-amber-800",
        danger: "border-rose-200 bg-rose-50 text-rose-800",
        info: "border-sky-200 bg-sky-50 text-sky-800",
        qb: "border-amber-300 bg-amber-100 text-amber-900 font-semibold",
        rb: "border-emerald-300 bg-emerald-100 text-emerald-900 font-semibold",
        wr: "border-sky-300 bg-sky-100 text-sky-900 font-semibold",
        te: "border-violet-300 bg-violet-100 text-violet-900 font-semibold",
        k: "border-zinc-300 bg-zinc-100 text-zinc-600 font-semibold",
        dst: "border-zinc-300 bg-zinc-100 text-zinc-600 font-semibold",
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
