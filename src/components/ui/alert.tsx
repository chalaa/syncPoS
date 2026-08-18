import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type AlertKind = "success" | "error" | "warning";

export function Alert({ kind, children }: { kind: AlertKind; children: ReactNode }) {
  return (
    <div
      className={cn(
        "mb-5 rounded-md border px-4 py-3 text-sm",
        kind === "success" && "border-input bg-secondary text-secondary-foreground",
        kind === "error" && "border-destructive/30 bg-card text-destructive",
        kind === "warning" && "border-input bg-muted text-foreground",
      )}
    >
      {children}
    </div>
  );
}
