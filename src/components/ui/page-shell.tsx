import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function PageShell({ children, maxWidth = "max-w-7xl" }: { children: ReactNode; maxWidth?: string }) {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className={cn("mx-auto w-full px-6 py-8", maxWidth)}>{children}</section>
    </main>
  );
}

export function PageHeader({
  eyebrow,
  title,
  actions,
}: {
  eyebrow: string;
  title: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-border pb-5">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">{eyebrow}</p>
        <h1 className="mt-1 text-2xl font-semibold">{title}</h1>
      </div>
      {actions}
    </header>
  );
}
