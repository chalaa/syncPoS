"use client";

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
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input bg-card text-foreground hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        primary: "bg-primary text-primary-foreground hover:bg-primary/90",
        danger:
          "border border-input bg-card text-destructive hover:bg-accent hover:text-destructive",
        success:
          "border border-input bg-card text-foreground hover:bg-accent hover:text-accent-foreground",
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

export function Button({
  className,
  variant,
  size,
  asChild = false,
  children,
  disabled,
  type,
  pendingLabel,
  ...props
}: ButtonProps) {
  const { pending } = useFormStatus();
  const isSubmitButton = !asChild && (type ?? "submit") === "submit";
  const isPending = isSubmitButton && pending;

  if (asChild) {
    return (
      <Slot
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      >
        {children}
      </Slot>
    );
  }

  return (
    <button
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
