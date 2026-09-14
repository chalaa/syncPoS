"use client";

import { ExternalLinkIcon, PencilIcon, PlusIcon, SearchIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";
import { filterAndSortByFuzzy } from "@/lib/search-utils";

import { useResizableDropdown } from "./use-resizable-dropdown";

export type RelatedModelOption = {
  id: string;
  name: string;
  code?: string | null;
};

type RelatedModelSelectProps = {
  name?: string;
  label?: string;
  options: RelatedModelOption[];
  value?: string | null;
  defaultValue?: string | null;
  placeholder?: string;
  emptyLabel?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
  error?: string;
  maxVisible?: number;
  clearLabel?: string;
  createHref?: string | ((query: string) => string);
  editHrefFor?: (id: string) => string;
  createLabel?: string;
  editLabel?: string;
  onCreateAndEdit?: (query: string) => void;
  onValueChange?: (value: string) => void;
};

const inputClass = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

function optionText(option: RelatedModelOption) {
  return option.code ? `${option.code} / ${option.name}` : option.name;
}

function selectedOptionText(option: RelatedModelOption) {
  return option.name;
}

export function RelatedModelSelect({
  name,
  label,
  options,
  value,
  defaultValue,
  placeholder = "Select",
  emptyLabel = "No records found.",
  required,
  disabled,
  className,
  inputClassName,
  error,
  maxVisible = 50,
  clearLabel = "None",
  createHref,
  editHrefFor,
  createLabel = "Create and Edit...",
  editLabel = "Edit selected",
  onCreateAndEdit,
  onValueChange,
}: RelatedModelSelectProps) {
  const [internalValue, setInternalValue] = useState(defaultValue ?? "");
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState<{ top: number; bottom: number; left: number; width: number }>({
    top: 0,
    bottom: 0,
    left: 0,
    width: 0,
  });
  const rootRef = useRef<HTMLElement | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const { height: dropdownHeight, hasCustomHeight, dropdownRef, handleResizeStart } = useResizableDropdown(
    isOpen,
    openUpward,
  );
  const selectedId = value ?? internalValue;
  const selected = options.find((option) => option.id === selectedId);
  const selectedLabel = selected ? selectedOptionText(selected) : "";
  const trimmedQuery = query.trim();
  const filteredOptions = useMemo(() => {
    if (!trimmedQuery) {
      return options;
    }

    return filterAndSortByFuzzy(options, trimmedQuery, (option) => {
      const primary = optionText(option);
      const code = option.code ? ` ${option.code}` : "";
      return `${primary}${code}`;
    });
  }, [options, trimmedQuery, optionText]);
  const visibleOptions = filteredOptions.slice(0, maxVisible);
  const newRecordHref = typeof createHref === "function" ? createHref(trimmedQuery) : createHref;
  const editRecordHref = selectedId && editHrefFor ? editHrefFor(selectedId) : "";

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen || !inputRef.current) return;

    function updatePositionAndPlacement() {
      if (!inputRef.current) return;
      const rect = inputRef.current.getBoundingClientRect();

      // If inside modal/dialog, check if input has scrolled out of view
      const modalEl = inputRef.current.closest('[role="dialog"]');
      if (modalEl) {
        const modalRect = modalEl.getBoundingClientRect();
        if (rect.bottom < modalRect.top + 10 || rect.top > modalRect.bottom - 10) {
          setIsOpen(false);
          return;
        }
      } else {
        if (rect.bottom < 10 || rect.top > window.innerHeight - 10) {
          setIsOpen(false);
          return;
        }
      }

      setCoords({
        top: rect.top,
        bottom: rect.bottom,
        left: rect.left,
        width: rect.width,
      });

      // Calculate placement
      const winHeight = window.innerHeight;
      const spaceBelowViewport = winHeight - rect.bottom - 24;
      const spaceAboveViewport = rect.top - 24;

      if (modalEl) {
        const modalRect = modalEl.getBoundingClientRect();
        const spaceToModalBottom = modalRect.bottom - rect.bottom - 70;
        const spaceInsideModalAbove = rect.top - modalRect.top - 20;

        if (spaceToModalBottom < 320 && spaceInsideModalAbove > spaceToModalBottom) {
          setOpenUpward(true);
          return;
        }
      }

      if (spaceBelowViewport < 340 && spaceAboveViewport > spaceBelowViewport) {
        setOpenUpward(true);
      } else {
        setOpenUpward(false);
      }
    }

    updatePositionAndPlacement();
    window.addEventListener("scroll", updatePositionAndPlacement, true);
    window.addEventListener("resize", updatePositionAndPlacement);

    return () => {
      window.removeEventListener("scroll", updatePositionAndPlacement, true);
      window.removeEventListener("resize", updatePositionAndPlacement);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function closeWhenClickOutside(event: PointerEvent) {
      const target = event.target as Node | null;

      if (
        (rootRef.current && rootRef.current.contains(target)) ||
        (dropdownRef.current && dropdownRef.current.contains(target))
      ) {
        return;
      }

      setIsOpen(false);
    }

    document.addEventListener("pointerdown", closeWhenClickOutside);

    return () => {
      document.removeEventListener("pointerdown", closeWhenClickOutside);
    };
  }, [isOpen, dropdownRef]);

  useEffect(() => {
    if (!isOpen || !dropdownRef.current) return;
    const el = dropdownRef.current;

    function stopScrollBubbling(e: Event) {
      e.stopPropagation();
    }

    el.addEventListener("wheel", stopScrollBubbling, { passive: true });
    el.addEventListener("touchmove", stopScrollBubbling, { passive: true });

    return () => {
      el.removeEventListener("wheel", stopScrollBubbling);
      el.removeEventListener("touchmove", stopScrollBubbling);
    };
  }, [isOpen, dropdownRef]);

  function openList() {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setCoords({
        top: rect.top,
        bottom: rect.bottom,
        left: rect.left,
        width: rect.width,
      });
      const winHeight = window.innerHeight;
      const spaceBelow = winHeight - rect.bottom - 24;
      const spaceAbove = rect.top - 24;
      const modalEl = inputRef.current.closest('[role="dialog"]');
      if (modalEl) {
        const modalRect = modalEl.getBoundingClientRect();
        const spaceToModalBottom = modalRect.bottom - rect.bottom - 70;
        const spaceInsideModalAbove = rect.top - modalRect.top - 20;
        if (spaceToModalBottom < 320 && spaceInsideModalAbove > spaceToModalBottom) {
          setOpenUpward(true);
          setIsOpen(true);
          return;
        }
      }
      setOpenUpward(spaceBelow < 340 && spaceAbove > spaceBelow);
    }
    setIsOpen(true);
  }

  function selectOption(nextValue: string) {
    setInternalValue(nextValue);
    setIsOpen(false);
    setQuery("");
    onValueChange?.(nextValue);
  }

  const resizeHandle = (
    <div
      onPointerDown={handleResizeStart}
      className={cn(
        "group flex h-3.5 w-full shrink-0 cursor-ns-resize items-center justify-center bg-muted/40 transition-colors hover:bg-muted active:bg-muted/80 select-none",
        openUpward ? "border-b border-border/60 rounded-t-md" : "border-t border-border/60 rounded-b-md",
      )}
      title="Drag to resize height"
    >
      <div className="h-1 w-8 rounded-full bg-muted-foreground/30 transition-colors group-hover:bg-muted-foreground/70" />
    </div>
  );

  const winHeight = typeof window !== "undefined" ? window.innerHeight : 800;
  const winWidth = typeof window !== "undefined" ? window.innerWidth : 1000;
  const availableSpaceDownward = Math.max(140, winHeight - coords.bottom - 20);
  const availableSpaceUpward = Math.max(140, coords.top - 20);
  const effectiveMaxHeight = openUpward ? availableSpaceUpward : availableSpaceDownward;
  const shouldFixHeight = (hasCustomHeight && visibleOptions.length > 3) || visibleOptions.length > 5;
  const effectiveHeight = shouldFixHeight ? Math.min(dropdownHeight, effectiveMaxHeight) : undefined;

  function handleDropdownWheel(event: React.WheelEvent<HTMLDivElement>) {
    // Prevent react-remove-scroll on document from cancelling the wheel event
    event.stopPropagation();
    const scrollEl = listRef.current;
    if (!scrollEl) return;

    const { scrollTop, scrollHeight, clientHeight } = scrollEl;
    const isScrollable = scrollHeight > clientHeight + 1;
    const isAtTop = scrollTop <= 0 && event.deltaY < 0;
    const isAtBottom = scrollTop + clientHeight >= scrollHeight - 2 && event.deltaY > 0;

    if (!isScrollable || isAtTop || isAtBottom) {
      // Forward wheel event to modal scroll container or window
      const modalScrollEl = inputRef.current?.closest('[role="dialog"]')?.querySelector('.overflow-y-auto');
      if (modalScrollEl) {
        modalScrollEl.scrollTop += event.deltaY;
      } else {
        window.scrollBy(0, event.deltaY);
      }
    }
  }

  const dropdownContent = (
    <div
      ref={dropdownRef}
      onPointerDown={(event) => event.stopPropagation()}
      onWheel={handleDropdownWheel}
      onTouchMove={(event) => event.stopPropagation()}
      style={{
        position: "fixed",
        left: `${Math.max(8, Math.min(coords.left, winWidth - Math.max(coords.width, 240) - 8))}px`,
        width: `${Math.max(coords.width, 240)}px`,
        zIndex: 999999,
        pointerEvents: "auto",
        maxHeight: `${effectiveMaxHeight}px`,
        height: effectiveHeight ? `${effectiveHeight}px` : undefined,
        ...(openUpward
          ? { bottom: `${Math.max(8, winHeight - coords.top + 6)}px` }
          : { top: `${coords.bottom + 6}px` }),
      }}
      className="flex flex-col rounded-md border border-border bg-popover text-popover-foreground shadow-2xl overflow-hidden resize-y pointer-events-auto select-auto"
    >
      {openUpward ? resizeHandle : null}

      <div ref={listRef} className="flex-1 overflow-y-auto p-1">
        {!trimmedQuery && visibleOptions.length > 0 ? (
          <div className="px-3 py-2 text-xs font-normal text-muted-foreground">{placeholder}</div>
        ) : null}
        {!required && !trimmedQuery && selectedId ? (
          <button
            type="button"
            onPointerDown={(event) => {
              event.preventDefault();
              selectOption("");
            }}
            onClick={() => selectOption("")}
            className="flex w-full rounded px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-secondary/80 hover:text-foreground"
          >
            {clearLabel}
          </button>
        ) : null}
        {visibleOptions.map((option) => (
          <button
            key={option.id}
            type="button"
            onPointerDown={(event) => {
              event.preventDefault();
              selectOption(option.id);
            }}
            onClick={() => selectOption(option.id)}
            className="flex w-full min-w-0 flex-col rounded px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-secondary/80"
          >
            <span className="max-w-full truncate font-medium">{option.name}</span>
            {option.code ? <span className="max-w-full truncate text-xs text-muted-foreground">{option.code}</span> : null}
          </button>
        ))}
        {filteredOptions.length === 0 ? (
          <p className="px-3 py-4 text-sm font-normal text-muted-foreground">{emptyLabel}</p>
        ) : null}
        {createHref || onCreateAndEdit || editRecordHref ? (
          <div className="border-t border-border pt-1">
            {onCreateAndEdit ? (
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setIsOpen(false);
                  onCreateAndEdit(trimmedQuery);
                }}
                onClick={() => {
                  setIsOpen(false);
                  onCreateAndEdit(trimmedQuery);
                }}
                className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-secondary/80"
              >
                <PlusIcon className="size-4" />
                {trimmedQuery ? `${createLabel.replace(/\.\.\.$/, "")} "${trimmedQuery}"` : createLabel}
              </button>
            ) : null}
            {newRecordHref ? (
              <Link
                href={newRecordHref}
                className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-secondary/80"
              >
                <PlusIcon className="size-4" />
                {trimmedQuery ? `${createLabel.replace(/\.\.\.$/, "")} "${trimmedQuery}"` : createLabel}
              </Link>
            ) : null}
            {editRecordHref ? (
              <Link
                href={editRecordHref}
                className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-secondary/80"
              >
                <PencilIcon className="size-4" />
                {editLabel}
                <ExternalLinkIcon className="ml-auto size-3 text-muted-foreground" />
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>

      {!openUpward ? resizeHandle : null}
    </div>
  );

  const dropdown = isOpen && mounted ? createPortal(dropdownContent, document.body) : null;

  const control = (
    <>
      {name ? <input type="hidden" name={name} value={selectedId} required={required} /> : null}
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={inputRef}
          value={isOpen ? query : selectedLabel}
          disabled={disabled}
          onChange={(event) => {
            setQuery(event.target.value);
            setIsOpen(true);
          }}
          onFocus={openList}
          onKeyDown={(event) => {
            if (event.key === "Escape" || event.key === "Tab") {
              setIsOpen(false);
              setQuery("");
            }
          }}
          placeholder={selectedLabel || placeholder}
          className={cn(
            inputClass,
            inputClassName,
            "pl-9",
            error ? "border-destructive focus-visible:border-destructive" : "",
            disabled ? "bg-muted text-muted-foreground" : "",
          )}
        />
        {dropdown}
      </div>
      {error ? <p className="text-sm font-normal text-destructive">{error}</p> : null}
    </>
  );

  if (!label) {
    return (
      <div
        ref={(node) => {
          rootRef.current = node;
        }}
        className={cn("relative", isOpen ? "z-50" : "z-0", className)}
      >
        {control}
      </div>
    );
  }

  return (
    <label
      ref={(node) => {
        rootRef.current = node;
      }}
      className={cn("relative flex flex-col gap-1 text-sm font-medium", isOpen ? "z-50" : "z-0", className)}
    >
      {label}
      {control}
    </label>
  );
}
