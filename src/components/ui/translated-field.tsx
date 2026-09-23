"use client";

import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";

import { useTranslation } from "@/lib/i18n/use-translation";

/**
 * Thin uncontrolled wrappers around native <input>/<textarea> that translate
 * the placeholder/aria-label props. Usable inside Server Component forms
 * (native form action submission is unaffected by the element being a
 * client leaf) without converting the whole form to a client component.
 */
export function TInput({ placeholder, "aria-label": ariaLabel, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  const { t } = useTranslation();
  return (
    <input
      {...props}
      placeholder={placeholder ? t(placeholder, placeholder) : placeholder}
      aria-label={ariaLabel ? t(ariaLabel, ariaLabel) : ariaLabel}
    />
  );
}

export function TTextarea({
  placeholder,
  "aria-label": ariaLabel,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { t } = useTranslation();
  return (
    <textarea
      {...props}
      placeholder={placeholder ? t(placeholder, placeholder) : placeholder}
      aria-label={ariaLabel ? t(ariaLabel, ariaLabel) : ariaLabel}
    />
  );
}
