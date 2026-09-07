"use client";

import { Label } from "@atlaskit/form/label/default";
import { CountrySelect } from "@atlaskit/select/country-select";
import { useId, useMemo, useState } from "react";

import { cn } from "@/lib/utils";

type CountryOption = {
  abbr: string;
  code: string;
  icon: string;
  name: string;
};

type CountrySelectFieldProps = {
  name: string;
  label: string;
  value?: string | null;
  defaultValue?: string | null;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  onValueChange?: (value: string) => void;
};

function optionFromCountryName(countryName?: string | null): CountryOption | null {
  const normalized = countryName?.trim();

  if (!normalized) {
    return null;
  }

  return {
    abbr: normalized.slice(0, 2).toUpperCase(),
    code: "",
    icon: "",
    name: normalized,
  };
}

export function CountrySelectField({
  name,
  label,
  value,
  defaultValue,
  required,
  disabled,
  className,
  onValueChange,
}: CountrySelectFieldProps) {
  const generatedId = useId();
  const [internalValue, setInternalValue] = useState(defaultValue ?? "");
  const isControlled = value !== undefined;
  const selectedValue = isControlled ? value ?? "" : internalValue;
  const selectedOption = useMemo(() => optionFromCountryName(selectedValue), [selectedValue]);

  return (
    <div className={cn("grid gap-1 text-sm font-medium", className)}>
      <Label htmlFor={generatedId}>{label}</Label>
      <input type="hidden" name={name} value={selectedValue} required={required} />
      <CountrySelect
        instanceId={`${generatedId}-country`}
        inputId={generatedId}
        value={selectedOption}
        placeholder=""
        isDisabled={disabled}
        isClearable={!required}
        onChange={(option) => {
          const country = Array.isArray(option) ? "" : option?.name ?? "";
          setInternalValue(country);
          onValueChange?.(country);
        }}
        formatOptionLabel={(option) => option.name}
        getOptionLabel={(option) => option.name}
      />
    </div>
  );
}
