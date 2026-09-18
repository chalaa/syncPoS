"use client";

import { SearchIcon, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { useTranslation } from "@/lib/i18n/use-translation";
import { cn } from "@/lib/utils";

type TableSearchInputProps = {
  paramName?: string;
  placeholder?: string;
  className?: string;
  defaultValue?: string;
};

export function TableSearchInput({
  paramName = "q",
  placeholder = "Search...",
  className,
  defaultValue = "",
}: TableSearchInputProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const { t } = useTranslation();

  const [value, setValue] = useState(defaultValue);
  const isInitialMount = useRef(true);

  useEffect(() => {
    const urlValue = searchParams.get(paramName) ?? "";
    setValue(urlValue);
  }, [searchParams, paramName]);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    const timer = setTimeout(() => {
      const currentUrlValue = searchParams.get(paramName) ?? "";
      if (value === currentUrlValue) return;

      const params = new URLSearchParams(searchParams.toString());
      if (value.trim()) {
        params.set(paramName, value.trim());
      } else {
        params.delete(paramName);
      }

      startTransition(() => {
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      });
    }, 250);

    return () => clearTimeout(timer);
  }, [value, pathname, router, searchParams, paramName]);

  const displayPlaceholder = t("action.searchProducts", t(placeholder, placeholder));

  return (
    <div className={cn("relative min-w-0 flex-1", className)}>
      <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={displayPlaceholder}
        className="h-10 w-full rounded-xl border border-input bg-background pl-9 pr-8 text-sm font-normal text-foreground transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />
      {value ? (
        <button
          type="button"
          onClick={() => setValue("")}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Clear search"
        >
          <X className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}
