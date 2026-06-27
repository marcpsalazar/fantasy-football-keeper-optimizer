import * as React from "react";

import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "mayhem-card rounded-md border border-zinc-200 bg-white shadow-sm dark:border-[#1a3050] dark:bg-[#071829]",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("mayhem-card-header border-b border-zinc-200 p-4 dark:border-[#1a3050]", className)}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        "mayhem-card-title font-['Oswald'] text-sm font-semibold uppercase tracking-wider",
        "text-zinc-950 dark:text-zinc-950",
        className,
      )}
      {...props}
    />
  );
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn("mayhem-card-description mt-1 text-sm text-zinc-600 dark:text-zinc-600", className)}
      {...props}
    />
  );
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-4", className)} {...props} />;
}
