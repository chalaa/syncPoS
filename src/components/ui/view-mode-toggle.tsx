"use client";

import { LayoutGrid, List, Table2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { useTranslation } from "@/lib/i18n/use-translation";
import { cn } from "@/lib/utils";

export type ViewMode = "table" | "list" | "grid";

type ViewModeToggleProps = {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
  className?: string;
  size?: "sm" | "md";
};

export function ViewModeToggle({
  value,
  onChange,
  className,
  size = "md",
}: ViewModeToggleProps) {
  const { t } = useTranslation();

  const options: { mode: ViewMode; label: string; icon: React.ElementType }[] = [
    { mode: "table", label: t("common.viewTable", "Table view"), icon: Table2 },
    { mode: "list", label: t("common.viewList", "List view"), icon: List },
    { mode: "grid", label: t("common.viewGrid", "Grid view"), icon: LayoutGrid },
  ];

  return (
    <div
      role="group"
      aria-label={t("common.viewOptions", "View options")}
      className={cn(
        "inline-flex items-center rounded-xl border border-border/80 bg-muted/40 p-1 shadow-2xs",
        className,
      )}
    >
      {options.map((opt) => {
        const Icon = opt.icon;
        const isActive = value === opt.mode;

        return (
          <button
            key={opt.mode}
            type="button"
            aria-pressed={isActive}
            title={opt.label}
            aria-label={opt.label}
            onClick={() => onChange(opt.mode)}
            className={cn(
              "relative flex items-center justify-center rounded-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
              size === "sm" ? "size-7 text-xs" : "size-8 text-sm",
              isActive
                ? "bg-background text-primary shadow-xs font-semibold border border-border/80"
                : "text-muted-foreground hover:bg-background/50 hover:text-foreground",
            )}
          >
            <Icon className={size === "sm" ? "size-3.5" : "size-4"} />
          </button>
        );
      })}
    </div>
  );
}

/**
 * Hook to manage table view mode with URL sync, localStorage persistence, and cross-component broadcast.
 */
export function useViewMode(storageKey?: string, defaultMode: ViewMode = "table") {
  const searchParams = useSearchParams();

  const [mode, setMode] = useState<ViewMode>(() => {
    const urlParam = searchParams?.get("layout") || searchParams?.get("viewMode");
    if (urlParam === "table" || urlParam === "list" || urlParam === "grid") {
      return urlParam;
    }
    if (typeof window !== "undefined" && storageKey) {
      try {
        const saved = localStorage.getItem(`syncpos_view_${storageKey}`) as ViewMode | null;
        if (saved === "table" || saved === "list" || saved === "grid") {
          return saved;
        }
      } catch {
        // Ignore localStorage access errors
      }
    }
    return defaultMode;
  });

  // Listen to cross-component view mode changes
  useEffect(() => {
    const handleEvent = (event: Event) => {
      const customEvent = event as CustomEvent<{ key?: string; mode: ViewMode }>;
      if (!storageKey || !customEvent.detail?.key || customEvent.detail?.key === storageKey) {
        if (customEvent.detail?.mode) {
          setMode(customEvent.detail.mode);
        }
      }
    };

    window.addEventListener("syncpos:viewmode", handleEvent);
    return () => window.removeEventListener("syncpos:viewmode", handleEvent);
  }, [storageKey]);

  // Sync if URL search params change (e.g. forward/back buttons)
  useEffect(() => {
    const urlParam = searchParams?.get("layout") || searchParams?.get("viewMode");
    if (urlParam === "table" || urlParam === "list" || urlParam === "grid") {
      setMode(urlParam);
    }
  }, [searchParams]);

  const changeMode = useCallback(
    (newMode: ViewMode) => {
      setMode(newMode);
      if (typeof window !== "undefined") {
        if (storageKey) {
          try {
            localStorage.setItem(`syncpos_view_${storageKey}`, newMode);
          } catch {
            // Ignore localStorage errors
          }
        }
        try {
          const url = new URL(window.location.href);
          url.searchParams.set("layout", newMode);
          window.history.replaceState(null, "", url.pathname + url.search);
        } catch {
          // Ignore URL replace errors
        }

        // Broadcast to all active components on this page
        window.dispatchEvent(
          new CustomEvent("syncpos:viewmode", {
            detail: { key: storageKey, mode: newMode },
          }),
        );
      }
    },
    [storageKey],
  );

  return [mode, changeMode] as const;
}
