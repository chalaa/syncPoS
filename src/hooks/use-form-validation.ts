"use client";

import { useMemo } from "react";

export type FormValidationResult = {
  formErrors: string[];
  fieldErrors: Record<string, string>;
};

export function useFormValidation<TValues>(
  values: TValues,
  validate: (values: TValues) => FormValidationResult,
) {
  const result = useMemo(() => validate(values), [values, validate]);

  return {
    ...result,
    isValid: result.formErrors.length === 0 && Object.keys(result.fieldErrors).length === 0,
  };
}
