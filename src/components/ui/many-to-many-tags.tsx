"use client";

import { PlusIcon, XIcon } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ManyToManyTagOption = {
  id: string;
  label: string;
};

export function ManyToManyTags({
  name,
  options,
  value,
  onChange,
  placeholder = "Add item",
  className,
}: {
  name: string;
  options: ManyToManyTagOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  className?: string;
}) {
  const [selectedOptionId, setSelectedOptionId] = useState("");
  const optionById = useMemo(() => new Map(options.map((option) => [option.id, option])), [options]);
  const availableOptions = options.filter((option) => !value.includes(option.id));

  function addSelectedOption() {
    if (!selectedOptionId || value.includes(selectedOptionId)) {
      return;
    }

    onChange([...value, selectedOptionId]);
    setSelectedOptionId("");
  }

  function removeOption(optionId: string) {
    onChange(value.filter((current) => current !== optionId));
  }

  return (
    <div className={cn("grid gap-2", className)}>
      <input type="hidden" name={name} value={value.join(",")} />
      <div className="flex min-h-9 flex-wrap items-center gap-1 rounded-md border border-input bg-background px-2 py-1">
        {value.map((optionId) => {
          const option = optionById.get(optionId);

          if (!option) {
            return null;
          }

          return (
            <span
              key={option.id}
              className="inline-flex h-7 max-w-52 items-center gap-1 rounded-md border border-border bg-muted px-2 text-xs font-medium"
            >
              <span className="truncate">{option.label}</span>
              <button
                type="button"
                aria-label={`Remove ${option.label}`}
                className="rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => removeOption(option.id)}
              >
                <XIcon className="size-3" />
              </button>
            </span>
          );
        })}
        {value.length === 0 ? (
          <span className="px-1 text-xs text-muted-foreground">No items selected</span>
        ) : null}
      </div>
      <div className="flex gap-2">
        <select
          value={selectedOptionId}
          onChange={(event) => setSelectedOptionId(event.target.value)}
          className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-sm"
        >
          <option value="">{placeholder}</option>
          {availableOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Add selected item"
          disabled={!selectedOptionId}
          onClick={addSelectedOption}
        >
          <PlusIcon />
        </Button>
      </div>
    </div>
  );
}
