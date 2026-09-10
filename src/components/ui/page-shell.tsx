import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function PageShell({ children, maxWidth = "max-w-7xl" }: { children: ReactNode; maxWidth?: string }) {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className={cn("mx-auto w-full px-4 py-5 sm:px-6 sm:py-8", maxWidth)}>{children}</section>
    </main>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-5 flex flex-col items-start justify-between gap-4 border-b border-border pb-5 sm:mb-6 sm:flex-row sm:items-center">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{eyebrow}</p>
        <h1 className="mt-1 break-words text-xl font-bold tracking-tight text-foreground sm:text-2xl">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions}
    </header>
  );
}
