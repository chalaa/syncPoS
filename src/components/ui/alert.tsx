"use client";

import type { ReactNode } from "react";

import { useTranslation } from "@/lib/i18n/use-translation";
import { cn } from "@/lib/utils";

type AlertKind = "success" | "error" | "warning";

export function Alert({ kind, children }: { kind: AlertKind; children: ReactNode }) {
  const { t } = useTranslation();

  const renderedContent = typeof children === "string" ? t(children, children) : children;

  return (
    <div
      className={cn(
        "mb-5 rounded-md border px-4 py-3 text-sm",
        kind === "success" && "border-primary/25 bg-secondary text-primary font-medium",
        kind === "error" && "border-destructive/30 bg-[#FDF5F5] text-destructive font-medium",
        kind === "warning" && "border-gold/40 bg-gold-muted text-[#7E5700] font-medium",
      )}
    >
      {renderedContent}
    </div>
  );
}
