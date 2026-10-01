"use client";

import { SlidersHorizontal, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { type ReactNode, useEffect, useRef, useState } from "react";

import { TableSearchInput } from "@/components/ui/table-search-input";
import { cn } from "@/lib/utils";

type TableFilterBarProps = {
  /** Placeholder for the search input */
  searchPlaceholder?: string;
  /** The filter controls – any number of <TableFilterSelect> or other nodes */
  children?: ReactNode;
  /** Custom class applied to the outer wrapper */
  className?: string;
  /** Names of search-param keys that belong to the filters (used for active-count badge) */
  filterParamNames?: string[];
};

/**
 * A responsive filter bar.
 *
 * Mobile  → search field + a SlidersHorizontal icon button.
 *           Tapping the icon slides open a filter panel containing all children.
 * Desktop → search field + all filter children displayed inline (classic layout).
 */
export function TableFilterBar({
  searchPlaceholder,
  children,
  className,
  filterParamNames = [],
}: TableFilterBarProps) {
  const searchParams = useSearchParams();
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Count how many filter params are currently active for the badge
  const activeCount = filterParamNames.filter(
    (name) => !!searchParams.get(name),
  ).length;

  // Close panel when any filter param changes (user made a selection)
  useEffect(() => {
    setIsOpen(false);
  }, [searchParams]);

  return (
    <div className={cn("border-b border-border bg-muted/20", className)}>
      {/* Main row */}
      <div className="flex flex-col gap-3 p-3.5 sm:p-4 lg:flex-row lg:items-center lg:justify-between">
        {/* Search & Mobile toggle container */}
        <div className="flex items-center gap-2 w-full lg:w-auto lg:flex-1 lg:max-w-md">
          <div className="w-full flex-1">
            <TableSearchInput placeholder={searchPlaceholder} />
          </div>

          {/* Mobile: filter toggle button */}
          {children ? (
            <button
              type="button"
              aria-expanded={isOpen}
              aria-label="Toggle filters"
              onClick={() => setIsOpen((o) => !o)}
              className={cn(
                "md:hidden relative inline-flex size-10 shrink-0 items-center justify-center rounded-xl border transition-all",
                isOpen
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : "border-border bg-background text-muted-foreground hover:border-border/80 hover:bg-muted/60 hover:text-foreground",
              )}
            >
              {isOpen ? (
                <X className="size-4" />
              ) : (
                <SlidersHorizontal className="size-4" />
              )}

              {/* Active-filter badge */}
              {activeCount > 0 && !isOpen ? (
                <span className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground leading-none">
                  {activeCount}
                </span>
              ) : null}
            </button>
          ) : null}
        </div>

        {/* Desktop & Tablet: filters inline */}
        {children ? (
          <div className="hidden md:flex flex-wrap items-center gap-2 sm:gap-2.5">
            {children}
          </div>
        ) : null}
      </div>

      {/* Mobile filter panel */}
      {children && isOpen ? (
        <div
          ref={panelRef}
          className="md:hidden border-t border-border/60 bg-muted/30 px-3.5 py-3 transition-all duration-200 ease-in-out"
        >
          <div className="flex flex-col gap-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Filters
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 items-center">
              {children}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
