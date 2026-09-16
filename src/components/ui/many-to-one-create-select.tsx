"use client";

import { PlusIcon, SearchIcon, UserPlus } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { filterAndSortByFuzzy } from "@/lib/search-utils";

import { useResizableDropdown } from "./use-resizable-dropdown";

export type ManyToOneOption = {
  id: string;
  code: string;
  name: string;
};

type CreateCustomerInput = {
  displayName: string;
  legalName?: string;
  tin?: string;
  phone?: string;
  email?: string;
};

type ManyToOneCreateSelectProps = {
  name: string;
  label: string;
  options: ManyToOneOption[];
  value?: string | null;
  defaultValue?: string | null;
  placeholder?: string;
  entityLabel?: string;
  onCreate: (input: CreateCustomerInput) => Promise<ManyToOneOption>;
  onValueChange?: (value: string) => void;
  error?: string;
};

const inputClass = "h-10 rounded-md border border-input bg-background px-3 text-sm";

export function ManyToOneCreateSelect({
  name,
  label,
  options,
  value,
  defaultValue,
  placeholder = "Search or create",
  entityLabel = "Customer",
  onCreate,
  onValueChange,
  error: fieldError,
}: ManyToOneCreateSelectProps) {
  const [internalValue, setInternalValue] = useState(defaultValue ?? "");
  const [createdItems, setCreatedItems] = useState<ManyToOneOption[]>([]);
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
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const { height: dropdownHeight, hasCustomHeight, dropdownRef, handleResizeStart } = useResizableDropdown(
    isOpen,
    openUpward,
  );

  const selectedId = value !== undefined ? (value ?? "") : internalValue;

  const allItems = useMemo(() => {
    const map = new Map<string, ManyToOneOption>();
    for (const opt of options) {
      map.set(opt.id, opt);
    }
    for (const opt of createdItems) {
      map.set(opt.id, opt);
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [options, createdItems]);

  const selected = allItems.find((item) => item.id === selectedId);
  const selectedLabel = selected ? selected.name : "";
  const trimmedQuery = query.trim();
  const filteredItems = useMemo(() => {
    if (!trimmedQuery) {
      return allItems;
    }

    return filterAndSortByFuzzy(allItems, trimmedQuery, (item) => `${item.name} ${item.code}`);
  }, [allItems, trimmedQuery]);
  const visibleItems = filteredItems.slice(0, 50);

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
        // Relax bounds check on mobile to prevent soft keyboard or minor scrolling from closing dropdown
        if (rect.bottom < modalRect.top - 20 || rect.top > modalRect.bottom + 20) {
          setIsOpen(false);
          return;
        }
      } else {
        if (rect.bottom < -20 || rect.top > window.innerHeight + 20) {
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
      const spaceBelowViewport = winHeight - rect.bottom - 12;
      const spaceAboveViewport = rect.top - 12;

      if (modalEl) {
        const modalRect = modalEl.getBoundingClientRect();
        const spaceToModalBottom = modalRect.bottom - rect.bottom - 40;
        const spaceInsideModalAbove = rect.top - modalRect.top - 20;

        if (spaceToModalBottom < 260 && spaceInsideModalAbove > spaceToModalBottom) {
          setOpenUpward(true);
          return;
        }
      }

      if (spaceBelowViewport < 260 && spaceAboveViewport > spaceBelowViewport) {
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
    if (!isOpen) return;

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

  function selectItem(item: ManyToOneOption) {
    setInternalValue(item.id);
    setIsOpen(false);
    setQuery("");
    onValueChange?.(item.id);
  }

  function openSelectionList() {
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

  function createCustomer(input: CreateCustomerInput) {
    setError(null);
    startTransition(async () => {
      try {
        const created = await onCreate(input);
        setCreatedItems((current) => [...current, created]);
        setInternalValue(created.id);
        setQuery("");
        setIsOpen(false);
        setIsDialogOpen(false);
        onValueChange?.(created.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : `Could not create ${entityLabel.toLowerCase()}.`);
      }
    });
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
  const isMobile = winWidth < 640;
  const availableSpaceDownward = Math.max(140, winHeight - coords.bottom - 12);
  const availableSpaceUpward = Math.max(140, coords.top - 12);
  const effectiveMaxHeight = openUpward ? availableSpaceUpward : availableSpaceDownward;
  const shouldFixHeight = (hasCustomHeight && visibleItems.length > 3) || visibleItems.length > 5;
  const effectiveHeight = shouldFixHeight ? Math.min(dropdownHeight, effectiveMaxHeight) : undefined;
  const dropdownWidth = isMobile ? Math.min(winWidth - 16, Math.max(coords.width, 280)) : Math.max(coords.width, 240);
  const dropdownLeft = isMobile
    ? Math.max(8, Math.min(coords.left, winWidth - dropdownWidth - 8))
    : Math.max(8, Math.min(coords.left, winWidth - dropdownWidth - 8));

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
        left: `${dropdownLeft}px`,
        width: `${dropdownWidth}px`,
        zIndex: 999999,
        pointerEvents: "auto",
        maxHeight: `${effectiveMaxHeight}px`,
        height: effectiveHeight ? `${effectiveHeight}px` : undefined,
        ...(openUpward
          ? { bottom: `${Math.max(8, winHeight - coords.top + 4)}px` }
          : { top: `${coords.bottom + 4}px` }),
      }}
      className="flex flex-col rounded-md border border-border bg-popover text-popover-foreground shadow-2xl overflow-hidden resize-y pointer-events-auto select-auto"
    >
      {openUpward ? resizeHandle : null}

      <div ref={listRef} className="flex-1 overflow-y-auto p-1">
        {visibleItems.map((item) => (
          <button
            key={item.id}
            type="button"
            onPointerDown={(event) => {
              event.preventDefault();
              selectItem(item);
            }}
            onClick={() => selectItem(item)}
            className="flex w-full flex-col rounded px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-secondary/80"
          >
            <span className="font-medium">{item.name}</span>
            <span className="text-xs text-muted-foreground">{item.code}</span>
          </button>
        ))}

        {filteredItems.length === 0 ? (
          <p className="px-3 py-3 text-xs text-muted-foreground">
            {trimmedQuery
              ? `No existing ${entityLabel.toLowerCase()} matching "${trimmedQuery}".`
              : `No ${entityLabel.toLowerCase()}s found.`}
          </p>
        ) : null}

        {trimmedQuery ? (
          <div className="border-t border-border pt-1">
            <button
              type="button"
              onPointerDown={(event) => {
                event.preventDefault();
                createCustomer({ displayName: trimmedQuery });
              }}
              onClick={() => createCustomer({ displayName: trimmedQuery })}
              disabled={isPending}
              className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-secondary/80 disabled:opacity-60 font-medium"
            >
              <PlusIcon className="size-4 text-[#0B5D4B]" />
              {isPending ? "Creating..." : `Quick Create "${trimmedQuery}"`}
            </button>
            <button
              type="button"
              onPointerDown={(event) => {
                event.preventDefault();
                setIsOpen(false);
                setIsDialogOpen(true);
              }}
              onClick={() => {
                setIsOpen(false);
                setIsDialogOpen(true);
              }}
              className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-secondary/80 font-medium"
            >
              <PlusIcon className="size-4 text-[#0B5D4B]" />
              Create & Edit ({entityLabel})...
            </button>
          </div>
        ) : null}
      </div>

      {!openUpward ? resizeHandle : null}
    </div>
  );

  const dropdown = isOpen && mounted ? createPortal(dropdownContent, document.body) : null;

  return (
    <div ref={rootRef} className="relative flex flex-col gap-1 text-sm font-medium">
      <span>{label}</span>
      <input type="hidden" name={name} value={selectedId} />
      <div className="flex items-center gap-1.5 w-full">
        <div className="relative flex-1 min-w-0">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            ref={inputRef}
            value={isOpen ? query : selectedLabel}
            onChange={(event) => {
              setQuery(event.target.value);
              setIsOpen(true);
            }}
            onFocus={openSelectionList}
            onPointerDown={() => {
              if (!isOpen) {
                openSelectionList();
              }
            }}
            onMouseDown={() => {
              if (!isOpen) {
                openSelectionList();
              }
            }}
            onClick={() => {
              if (!isOpen) {
                openSelectionList();
              }
            }}
            placeholder={selectedLabel || placeholder}
            className={cn(inputClass, "w-full pl-9", fieldError ? "border-destructive focus-visible:border-destructive" : "")}
          />
        </div>

        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => {
            setIsOpen(false);
            setIsDialogOpen(true);
          }}
          className="size-9 sm:size-10 shrink-0 rounded-lg border-border/80 text-muted-foreground transition-all hover:border-[#0B5D4B]/40 hover:bg-emerald-500/10 hover:text-[#0B5D4B] dark:hover:text-emerald-300 active:scale-95"
          title={`Create and select new ${entityLabel.toLowerCase()}`}
        >
          <UserPlus className="size-4" />
          <span className="sr-only">Add {entityLabel}</span>
        </Button>

        {dropdown}
      </div>

      {fieldError ? <p className="text-sm font-normal text-destructive">{fieldError}</p> : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <CustomerCreateDialog
        open={isDialogOpen}
        initialName={trimmedQuery}
        isPending={isPending}
        error={error}
        entityLabel={entityLabel}
        onOpenChange={setIsDialogOpen}
        onCreate={createCustomer}
      />
    </div>
  );
}

function CustomerCreateDialog({
  open,
  initialName,
  isPending,
  error,
  entityLabel,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  initialName: string;
  isPending: boolean;
  error: string | null;
  entityLabel: string;
  onOpenChange: (open: boolean) => void;
  onCreate: (input: CreateCustomerInput) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent overlayClassName="z-[70]" className="z-[75] w-[calc(100%-1.5rem)] sm:w-full max-w-2xl max-h-[92vh] sm:max-h-[90vh] overflow-y-auto outline-none">
        <form
          className="grid gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);

            onCreate({
              displayName: String(formData.get("displayName") ?? ""),
              legalName: String(formData.get("legalName") ?? ""),
              tin: String(formData.get("tin") ?? ""),
              phone: String(formData.get("phone") ?? ""),
              email: String(formData.get("email") ?? ""),
            });
          }}
        >
          <DialogHeader>
            <DialogTitle>Create {entityLabel}</DialogTitle>
            <DialogDescription>Create a new {entityLabel.toLowerCase()} and automatically select it on this document.</DialogDescription>
          </DialogHeader>

          {error ? <p className="rounded-md border border-destructive/30 p-3 text-sm text-destructive">{error}</p> : null}

          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm font-medium">
              Display Name <span className="text-destructive">*</span>
              <input name="displayName" required defaultValue={initialName} className={inputClass} placeholder={`e.g. Acme ${entityLabel}`} />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Legal Name
              <input name="legalName" className={inputClass} placeholder="Official business name" />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              TIN
              <input name="tin" className={inputClass} placeholder="Tax Identification Number" />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Phone
              <input name="phone" className={inputClass} placeholder="+251..." />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium md:col-span-2">
              Email
              <input name="email" type="email" className={inputClass} placeholder="contact@domain.com" />
            </label>
          </div>

          <DialogFooter className="flex flex-col-reverse sm:flex-row justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending} className="bg-[#0B5D4B] hover:bg-[#073B35] text-white font-semibold">
              {isPending ? "Creating..." : `Create & Select ${entityLabel}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
