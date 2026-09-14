"use client";

import * as React from "react";
import Link from "next/link";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { LoaderCircleIcon } from "lucide-react";
import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from "react";
import { useFormStatus } from "react-dom";

import { cn } from "@/lib/utils";

function defaultPendingLabel(children: ReactNode) {
  if (typeof children !== "string") {
    return "Working...";
  }

  const label = children.trim();
  const normalizedLabel = label.toLowerCase();

  if (normalizedLabel === "sign in") {
    return "Signing in...";
  }

  if (normalizedLabel.startsWith("save")) {
    return "Saving...";
  }

  if (normalizedLabel.startsWith("create")) {
    return "Creating...";
  }

  if (normalizedLabel.startsWith("post")) {
    return "Posting...";
  }

  if (normalizedLabel.startsWith("register")) {
    return "Registering...";
  }

  if (normalizedLabel.startsWith("approve")) {
    return "Approving...";
  }

  if (normalizedLabel.startsWith("dispatch")) {
    return "Dispatching...";
  }

  if (normalizedLabel.startsWith("cancel")) {
    return "Cancelling...";
  }

  if (normalizedLabel.startsWith("apply")) {
    return "Applying...";
  }

  return `${label}...`;
}

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold transition-colors outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-60 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-dark shadow-xs",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-xs",
        outline:
          "border border-input bg-card text-foreground hover:bg-secondary hover:text-secondary-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-secondary hover:text-secondary-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        primary: "bg-primary text-primary-foreground hover:bg-dark shadow-xs",
        accent: "bg-gold text-dark hover:bg-accent-dark hover:text-white font-bold shadow-xs",
        danger:
          "border border-input bg-card text-destructive hover:bg-destructive/10",
        success:
          "border border-input bg-card text-primary hover:bg-secondary",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3",
        lg: "h-11 px-6",
        icon: "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    pendingLabel?: ReactNode;
  };

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      children,
      disabled,
      type,
      pendingLabel,
      ...props
    },
    ref
  ) => {
    const { pending } = useFormStatus();
    const isSubmitButton = !asChild && (type ?? "submit") === "submit";
    const isPending = isSubmitButton && pending;

    if (asChild) {
      return (
        <Slot
          ref={ref}
          className={cn(buttonVariants({ variant, size, className }))}
          {...props}
        >
          {children}
        </Slot>
      );
    }

    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        aria-busy={isPending || undefined}
        disabled={disabled || isPending}
        type={type}
        {...props}
      >
        {isPending ? <LoaderCircleIcon className="animate-spin" aria-hidden="true" /> : null}
        {isPending ? (pendingLabel ?? defaultPendingLabel(children)) : children}
      </button>
    );
  }
);
Button.displayName = "Button";

export function ButtonLink({
  href,
  children,
  variant = "outline",
  size,
  className,
}: {
  href: string;
  children: ReactNode;
  variant?: ComponentProps<typeof Button>["variant"];
  size?: ComponentProps<typeof Button>["size"];
  className?: string;
}) {
  return (
    <Button asChild variant={variant} size={size} className={className}>
      <Link href={href}>{children}</Link>
    </Button>
  );
}
