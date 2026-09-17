"use client";

import type { ReactNode } from "react";
import { useTranslation } from "@/lib/i18n/use-translation";
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
  const { t } = useTranslation();

  const translatedEyebrow = typeof eyebrow === "string" ? t(`header.eyebrow.${eyebrow}`, t(eyebrow)) : eyebrow;
  const translatedTitle = typeof title === "string" ? t(`header.title.${title}`, t(title)) : title;
  const translatedDescription = typeof description === "string" ? t(`header.desc.${description}`, t(description)) : description;

  return (
    <header className="mb-5 flex flex-col items-start justify-between gap-4 border-b border-border pb-5 sm:mb-6 sm:flex-row sm:items-center">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{translatedEyebrow}</p>
        <h1 className="mt-1 break-words text-xl font-bold tracking-tight text-foreground sm:text-2xl">{translatedTitle}</h1>
        {translatedDescription ? <p className="mt-1 text-sm text-muted-foreground">{translatedDescription}</p> : null}
      </div>
      {actions}
    </header>
  );
}
