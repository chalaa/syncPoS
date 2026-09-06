"use client";

import { SearchIcon } from "lucide-react";
import { useMemo, useRef, useState, type FocusEvent } from "react";

import { cn } from "@/lib/utils";

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
  onValueChange?: (value: string) => void;
};

const inputClass = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

function optionText(option: RelatedModelOption) {
  return option.code ? `${option.code} / ${option.name}` : option.name;
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
  maxVisible = 5,
  clearLabel = "None",
  onValueChange,
}: RelatedModelSelectProps) {
  const [internalValue, setInternalValue] = useState(defaultValue ?? "");
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const selectedId = value ?? internalValue;
  const selected = options.find((option) => option.id === selectedId);
  const selectedLabel = selected ? optionText(selected) : "";
  const trimmedQuery = query.trim();
  const filteredOptions = useMemo(() => {
    const normalized = trimmedQuery.toLowerCase();

    if (!normalized) {
      return options;
    }

    return options.filter((option) => optionText(option).toLowerCase().includes(normalized));
  }, [options, trimmedQuery]);
  const visibleOptions = filteredOptions.slice(0, maxVisible);

  function openList() {
    if (disabled) {
      return;
    }

    setQuery("");
    setIsOpen(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function selectOption(optionId: string) {
    setInternalValue(optionId);
    onValueChange?.(optionId);
    setQuery("");
    setIsOpen(false);
  }

  function closeWhenFocusLeaves(event: FocusEvent<HTMLElement>) {
    if (event.currentTarget.contains(event.relatedTarget)) {
      return;
    }

    setIsOpen(false);
    setQuery("");
  }

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
          placeholder={selectedLabel || placeholder}
          className={cn(
            inputClass,
            inputClassName,
            "pl-9",
            error ? "border-destructive focus-visible:border-destructive" : "",
            disabled ? "bg-muted text-muted-foreground" : "",
          )}
        />

        {isOpen ? (
          <div className="absolute left-0 top-full z-50 mt-1 max-h-72 w-max min-w-full max-w-[min(32rem,calc(100vw-2rem))] overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-lg">
            {!trimmedQuery && visibleOptions.length > 0 ? (
              <div className="px-3 py-2 text-xs font-normal text-muted-foreground">{placeholder}</div>
            ) : null}
            {!required && !trimmedQuery && selectedId ? (
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectOption("")}
                className="flex w-full rounded px-3 py-2 text-left text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              >
                {clearLabel}
              </button>
            ) : null}
            {visibleOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectOption(option.id)}
                className="flex w-full min-w-0 flex-col rounded px-3 py-2 text-left text-sm hover:bg-accent"
              >
                <span className="max-w-full truncate font-medium">{option.name}</span>
                {option.code ? <span className="max-w-full truncate text-xs text-muted-foreground">{option.code}</span> : null}
              </button>
            ))}
            {filteredOptions.length === 0 ? (
              <p className="px-3 py-4 text-sm font-normal text-muted-foreground">{emptyLabel}</p>
            ) : null}
          </div>
        ) : null}
      </div>
      {error ? <p className="text-sm font-normal text-destructive">{error}</p> : null}
    </>
  );

  if (!label) {
    return (
      <div className={cn("relative", className)} onBlur={closeWhenFocusLeaves}>
        {control}
      </div>
    );
  }

  return (
    <label
      className={cn("relative flex flex-col gap-1 text-sm font-medium", className)}
      onBlur={closeWhenFocusLeaves}
    >
      {label}
      {control}
    </label>
  );
}
