import * as React from "react"

import { cn } from "@/lib/utils"

const badgeVariantClasses = {
  default: "bg-primary text-primary-foreground",
  secondary: "bg-secondary text-secondary-foreground",
  success: "bg-success/15 text-success",
  destructive: "bg-destructive/15 text-destructive",
  outline: "border border-border text-muted-foreground",
} as const

export type BadgeVariant = keyof typeof badgeVariantClasses

export interface BadgeProps extends React.ComponentProps<"span"> {
  variant?: BadgeVariant
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      data-slot="badge"
      className={cn(
        "inline-flex w-fit shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap [&_svg]:pointer-events-none [&_svg]:size-3",
        badgeVariantClasses[variant],
        className,
      )}
      {...props}
    />
  )
}

export { Badge, badgeVariantClasses }
