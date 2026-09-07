"use client";

import { ExternalLinkIcon, PencilIcon, PlusIcon, SearchIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type FocusEvent } from "react";
import { createPortal } from "react-dom";

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
  const [dropdownStyle, setDropdownStyle] = useState<CSSProperties | undefined>();
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
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
  const newRecordHref = typeof createHref === "function" ? createHref(trimmedQuery) : createHref;
  const editRecordHref = selectedId && editHrefFor ? editHrefFor(selectedId) : "";

  function floatingDropdownStyle() {
    const inputRect = inputRef.current?.getBoundingClientRect();

    if (!inputRect) {
      return undefined;
    }

    const viewportPadding = 8;
    const maxWidth = Math.max(window.innerWidth - viewportPadding * 2, inputRect.width);
    const width = Math.min(Math.max(inputRect.width, 240), 512, maxWidth);
    const left = Math.min(
      Math.max(inputRect.left, viewportPadding),
      Math.max(window.innerWidth - width - viewportPadding, viewportPadding),
    );

    return {
      left,
      top: inputRect.bottom + 4,
      width,
    };
  }

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function closeFloatingList(event: Event) {
      if (dropdownRef.current?.contains(event.target as Node)) {
        return;
      }

      setIsOpen(false);
      setQuery("");
      setDropdownStyle(undefined);
    }

    window.addEventListener("resize", closeFloatingList);
    window.addEventListener("scroll", closeFloatingList, true);

    return () => {
      window.removeEventListener("resize", closeFloatingList);
      window.removeEventListener("scroll", closeFloatingList, true);
    };
  }, [isOpen]);

  function openList() {
    if (disabled) {
      return;
    }

    setQuery("");
    setDropdownStyle(floatingDropdownStyle());
    setIsOpen(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function selectOption(optionId: string) {
    setInternalValue(optionId);
    onValueChange?.(optionId);
    setQuery("");
    setIsOpen(false);
    setDropdownStyle(undefined);
  }

  function closeWhenFocusLeaves(event: FocusEvent<HTMLElement>) {
    if (event.currentTarget.contains(event.relatedTarget)) {
      return;
    }

    setIsOpen(false);
    setQuery("");
    setDropdownStyle(undefined);
  }

  const dropdown = isOpen && dropdownStyle
    ? createPortal(
        <div
          ref={dropdownRef}
          onMouseDown={(event) => event.preventDefault()}
          className="fixed z-[1000] max-h-72 overflow-y-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-lg"
          style={dropdownStyle}
        >
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
          {createHref || onCreateAndEdit || editRecordHref ? (
            <div className="border-t border-border pt-1">
              {onCreateAndEdit ? (
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    setIsOpen(false);
                    setDropdownStyle(undefined);
                    onCreateAndEdit(trimmedQuery);
                  }}
                  className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm hover:bg-accent"
                >
                  <PlusIcon className="size-4" />
                  {trimmedQuery ? `${createLabel.replace(/\.\.\.$/, "")} "${trimmedQuery}"` : createLabel}
                </button>
              ) : null}
              {newRecordHref ? (
                <Link
                  href={newRecordHref}
                  className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm hover:bg-accent"
                >
                  <PlusIcon className="size-4" />
                  {trimmedQuery ? `${createLabel.replace(/\.\.\.$/, "")} "${trimmedQuery}"` : createLabel}
                </Link>
              ) : null}
              {editRecordHref ? (
                <Link
                  href={editRecordHref}
                  className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm hover:bg-accent"
                >
                  <PencilIcon className="size-4" />
                  {editLabel}
                  <ExternalLinkIcon className="ml-auto size-3 text-muted-foreground" />
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>,
        document.body,
      )
    : null;

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
            setDropdownStyle(floatingDropdownStyle());
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
      </div>
      {dropdown}
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
