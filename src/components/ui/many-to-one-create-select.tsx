"use client";

import { PlusIcon, SearchIcon } from "lucide-react";
import { useMemo, useState, useTransition } from "react";

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
  defaultValue,
  placeholder = "Search or create",
  entityLabel = "Customer",
  onCreate,
  onValueChange,
  error: fieldError,
}: ManyToOneCreateSelectProps) {
  const [items, setItems] = useState(options);
  const [selectedId, setSelectedId] = useState(defaultValue ?? "");
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selected = items.find((item) => item.id === selectedId);
  const trimmedQuery = query.trim();
  const filteredItems = useMemo(() => {
    const normalized = trimmedQuery.toLowerCase();

    if (!normalized) {
      return items;
    }

    return items.filter((item) =>
      `${item.code} ${item.name}`.toLowerCase().includes(normalized),
    );
  }, [items, trimmedQuery]);

  function selectItem(option: ManyToOneOption) {
    setSelectedId(option.id);
    onValueChange?.(option.id);
    setQuery("");
    setIsOpen(false);
    setError(null);
  }

  function createCustomer(input: CreateCustomerInput) {
    setError(null);
    startTransition(async () => {
      try {
        const created = await onCreate(input);

        setItems((current) => {
          if (current.some((item) => item.id === created.id)) {
            return current;
          }

          return [...current, created].sort((a, b) => a.name.localeCompare(b.name));
        });
        setSelectedId(created.id);
        onValueChange?.(created.id);
        setQuery("");
        setIsOpen(false);
        setIsDialogOpen(false);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : `Could not create ${entityLabel.toLowerCase()}.`);
      }
    });
  }

  return (
    <div className="relative flex flex-col gap-1 text-sm font-medium">
      <span>{label}</span>
      <input type="hidden" name={name} value={selectedId} />
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={isOpen ? query : selected ? `${selected.code} / ${selected.name}` : ""}
          onChange={(event) => {
            setQuery(event.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className={cn(inputClass, "w-full pl-9", fieldError ? "border-destructive focus-visible:border-destructive" : "")}
        />
      </div>

      {fieldError ? <p className="text-sm font-normal text-destructive">{fieldError}</p> : null}

      {isOpen ? (
        <div className="absolute left-0 right-0 top-[4.25rem] z-20 max-h-72 overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-lg">
          {filteredItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => selectItem(item)}
              className="flex w-full flex-col rounded px-3 py-2 text-left text-sm hover:bg-accent"
            >
              <span className="font-medium">{item.name}</span>
              <span className="text-xs text-muted-foreground">{item.code}</span>
            </button>
          ))}

          {trimmedQuery ? (
            <div className="border-t border-border pt-1">
              <button
                type="button"
                onClick={() => createCustomer({ displayName: trimmedQuery })}
                disabled={isPending}
                className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm hover:bg-accent disabled:opacity-60"
              >
                <PlusIcon className="size-4" />
                {isPending ? "Creating..." : `Create "${trimmedQuery}"`}
              </button>
              <button
                type="button"
                onClick={() => setIsDialogOpen(true)}
                className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm hover:bg-accent"
              >
                <PlusIcon className="size-4" />
                Create and Edit...
              </button>
            </div>
          ) : null}

          {filteredItems.length === 0 && !trimmedQuery ? (
            <p className="px-3 py-4 text-sm text-muted-foreground">No {entityLabel.toLowerCase()}s found.</p>
          ) : null}
        </div>
      ) : null}

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
      <DialogContent className="max-w-2xl">
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
            <DialogDescription>Create a {entityLabel.toLowerCase()} and select it on this document.</DialogDescription>
          </DialogHeader>

          {error ? <p className="rounded-md border border-destructive/30 p-3 text-sm text-destructive">{error}</p> : null}

          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm font-medium">
              Display Name
              <input name="displayName" required defaultValue={initialName} className={inputClass} />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Legal Name
              <input name="legalName" className={inputClass} />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              TIN
              <input name="tin" className={inputClass} />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Phone
              <input name="phone" className={inputClass} />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium md:col-span-2">
              Email
              <input name="email" type="email" className={inputClass} />
            </label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Creating..." : `Create ${entityLabel}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
