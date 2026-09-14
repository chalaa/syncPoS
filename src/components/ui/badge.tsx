import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors border select-none",
  {
    variants: {
      variant: {
        default:
          "border-primary/30 bg-primary/10 text-primary hover:bg-primary/15",
        primary:
          "border-primary/30 bg-primary/10 text-primary hover:bg-primary/20",
        secondary:
          "border-border bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/15",
        outline:
          "border-border text-foreground hover:bg-secondary/50",
        success:
          "border-primary/30 bg-primary/10 text-primary hover:bg-primary/20",
        warning:
          "border-gold/40 bg-gold-muted text-dark hover:bg-gold/20",
        accent:
          "border-gold/50 bg-gold/15 text-dark font-semibold hover:bg-gold/25",
        dark:
          "border-dark/30 bg-dark text-dark-foreground hover:bg-dark/90",
        muted:
          "border-border/60 bg-muted/60 text-muted-foreground",
      },
      size: {
        sm: "px-2 py-0.2 text-[11px] leading-tight",
        default: "px-2.5 py-0.5 text-xs",
        lg: "px-3 py-1 text-xs font-semibold",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean;
}

export const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant, size, dot = false, children, ...props }, ref) => {
    const dotColorClass = React.useMemo(() => {
      switch (variant) {
        case "destructive":
          return "bg-destructive";
        case "warning":
        case "accent":
          return "bg-gold";
        case "secondary":
        case "muted":
          return "bg-muted-foreground";
        case "dark":
          return "bg-gold";
        case "success":
        case "default":
        default:
          return "bg-primary";
      }
    }, [variant]);

    return (
      <div ref={ref} className={cn(badgeVariants({ variant, size }), className)} {...props}>
        {dot ? (
          <span
            className={cn("size-1.5 shrink-0 rounded-full", dotColorClass)}
            aria-hidden="true"
          />
        ) : null}
        {children}
      </div>
    );
  }
);
Badge.displayName = "Badge";

/**
 * Intelligent StatusBadge that automatically styles and labels
 * any document, payment, inventory, or workflow status.
 */
export const StatusBadge = React.forwardRef<
  HTMLDivElement,
  {
    status: string | null | undefined;
    label?: string;
    size?: "sm" | "default" | "lg";
    className?: string;
  } & React.HTMLAttributes<HTMLDivElement>
>(({ status, label, size = "default", className, ...props }, ref) => {
  if (!status) {
    return (
      <span ref={ref as React.Ref<HTMLSpanElement>} className="text-xs text-muted-foreground" {...props}>
        -
      </span>
    );
  }

  const normalized = status.toLowerCase().trim();
  const displayLabel = label ?? status.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  // Green / Posted / Completed / Success
  if (
    [
      "posted",
      "confirmed",
      "delivered",
      "completed",
      "paid",
      "active",
      "received",
      "in_stock",
      "success",
      "imported",
      "approved",
    ].includes(normalized)
  ) {
    return (
      <Badge ref={ref} variant="success" dot size={size} className={className} {...props}>
        {displayLabel}
      </Badge>
    );
  }

  // Gold / Draft / Warning / In-Progress / Partial
  if (
    [
      "draft",
      "quotation",
      "pending",
      "partial",
      "partially_paid",
      "partially_delivered",
      "partially_received",
      "inbound",
      "reserved",
      "warning",
      "preview",
      "review",
      "transit",
    ].includes(normalized)
  ) {
    return (
      <Badge ref={ref} variant="warning" dot size={size} className={className} {...props}>
        {displayLabel}
      </Badge>
    );
  }

  // Red / Destructive / Error / Cancelled
  if (
    [
      "cancelled",
      "void",
      "rejected",
      "error",
      "failed",
      "disabled",
      "locked",
      "unpaid",
      "negative",
      "out_of_stock",
      "overdue",
    ].includes(normalized)
  ) {
    return (
      <Badge ref={ref} variant="destructive" dot size={size} className={className} {...props}>
        {displayLabel}
      </Badge>
    );
  }

  // Neutral / Secondary / Outbound / Closed
  return (
    <Badge ref={ref} variant="secondary" size={size} className={className} {...props}>
      {displayLabel}
    </Badge>
  );
});
StatusBadge.displayName = "StatusBadge";

