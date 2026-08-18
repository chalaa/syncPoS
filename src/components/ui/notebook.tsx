"use client";

import { useId, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

type NotebookItem = {
  value: string;
  label: string;
  content: ReactNode;
};

export function Notebook({
  items,
  defaultValue,
  className,
}: {
  items: NotebookItem[];
  defaultValue?: string;
  className?: string;
}) {
  const fallbackValue = items[0]?.value ?? "";
  const [activeValue, setActiveValue] = useState(defaultValue ?? fallbackValue);
  const baseId = useId();
  const resolvedActiveValue = items.some((item) => item.value === activeValue)
    ? activeValue
    : fallbackValue;

  if (items.length === 0) {
    return null;
  }

  return (
    <section className={cn("overflow-hidden rounded-md border border-border bg-card", className)}>
      <div className="flex min-h-11 items-end gap-1 border-b border-border bg-muted/30 px-3 pt-2">
        {items.map((item) => {
          const isActive = item.value === resolvedActiveValue;
          const tabId = `${baseId}-${item.value}-tab`;
          const panelId = `${baseId}-${item.value}-panel`;

          return (
            <button
              key={item.value}
              id={tabId}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={panelId}
              className={cn(
                "h-9 rounded-t-md border border-transparent px-4 text-sm font-medium text-muted-foreground outline-none transition-colors",
                "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
                isActive &&
                  "border-border border-b-card bg-card text-foreground shadow-[0_-1px_0_hsl(var(--border))]",
              )}
              onClick={() => setActiveValue(item.value)}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {items.map((item) => {
        const isActive = item.value === resolvedActiveValue;

        return (
          <div
            key={item.value}
            id={`${baseId}-${item.value}-panel`}
            role="tabpanel"
            aria-labelledby={`${baseId}-${item.value}-tab`}
            hidden={!isActive}
            className="p-4"
          >
            {item.content}
          </div>
        );
      })}
    </section>
  );
}
