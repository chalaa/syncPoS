"use client";

import { PlusIcon, Trash2Icon } from "lucide-react";
import { useCallback, useId, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useFormValidation, type FormValidationResult } from "@/hooks/use-form-validation";
import { cn } from "@/lib/utils";
import type { PaymentAccountOption, PaymentLineRow } from "@/server/payments/types";

type PaymentFormAction = (formData: FormData) => Promise<void>;

type PaymentFormDialogProps = {
  title: string;
  description: string;
  triggerLabel: string;
  submitLabel: string;
  action: PaymentFormAction;
  hiddenFieldName: string;
  hiddenFieldValue: string;
  paymentAccounts: PaymentAccountOption[];
  currencyCode: string;
  amountMinor: number;
  paymentAccountId?: string;
  reference?: string | null;
  notes?: string | null;
  paymentLines?: PaymentLineRow[];
};

function minorToInputValue(value: number) {
  return (value / 100).toFixed(2);
}

function inputValueToMinor(value: string) {
  const parsed = Number.parseFloat(value);

  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

type DraftPaymentLine = {
  key: string;
  paymentAccountId: string;
  amount: string;
  reference: string;
  note: string;
};

type PaymentValidationValues = {
  lines: DraftPaymentLine[];
  targetAmountMinor: number;
  accountById: Map<string, PaymentAccountOption>;
};

export function PaymentFormDialog({
  title,
  description,
  triggerLabel,
  submitLabel,
  action,
  hiddenFieldName,
  hiddenFieldValue,
  paymentAccounts,
  currencyCode,
  amountMinor,
  paymentAccountId,
  reference,
  notes,
  paymentLines,
}: PaymentFormDialogProps) {
  const idPrefix = useId();
  const nextLineId = useRef(2);
  const matchingAccounts = paymentAccounts.filter((account) => account.currencyCode === currencyCode);
  const accountById = useMemo(() => new Map(matchingAccounts.map((account) => [account.id, account])), [matchingAccounts]);
  const initialLines = useMemo<DraftPaymentLine[]>(() => {
    if (paymentLines?.length) {
      return paymentLines.map((line) => ({
        key: line.id,
        paymentAccountId: line.paymentAccountId,
        amount: minorToInputValue(line.amountMinor),
        reference: line.reference ?? "",
        note: line.note ?? "",
      }));
    }

    return [
      {
        key: `${idPrefix}-line-1`,
        paymentAccountId: paymentAccountId ?? "",
        amount: minorToInputValue(amountMinor),
        reference: reference ?? "",
        note: notes ?? "",
      },
    ];
  }, [amountMinor, idPrefix, notes, paymentAccountId, paymentLines, reference]);
  const [lines, setLines] = useState(initialLines);
  const enteredAmountMinor = lines.reduce((sum, line) => sum + inputValueToMinor(line.amount), 0);
  const remainingAmountMinor = Math.max(amountMinor - enteredAmountMinor, 0);
  const validatePaymentForm = useCallback((values: PaymentValidationValues): FormValidationResult => {
    const fieldErrors: Record<string, string> = {};
    const formErrors: string[] = [];

    if (values.lines.length === 0) {
      formErrors.push("Add at least one payment line.");
    }

    values.lines.forEach((line, index) => {
      const lineNo = index + 1;
      const account = values.accountById.get(line.paymentAccountId);
      const amount = Number.parseFloat(line.amount);

      if (!line.paymentAccountId) {
        fieldErrors[`lines.${index}.paymentAccountId`] = `Select a payment account on line ${lineNo}.`;
      } else if (!account) {
        fieldErrors[`lines.${index}.paymentAccountId`] = `Select an active payment account on line ${lineNo}.`;
      }

      if (!Number.isFinite(amount) || amount <= 0) {
        fieldErrors[`lines.${index}.amount`] = `Enter an amount greater than zero on line ${lineNo}.`;
      }

      if (account?.requiresReference && !line.reference.trim()) {
        fieldErrors[`lines.${index}.reference`] = `Reference is required on line ${lineNo}.`;
      }
    });

    const totalMinor = values.lines.reduce((sum, line) => sum + inputValueToMinor(line.amount), 0);
    if (totalMinor > values.targetAmountMinor) {
      formErrors.push("Payment lines cannot exceed the remaining amount.");
    }

    return { formErrors, fieldErrors };
  }, []);
  const validationValues = useMemo(
    () => ({ lines, targetAmountMinor: amountMinor, accountById }),
    [accountById, amountMinor, lines],
  );
  const { formErrors, fieldErrors, isValid } = useFormValidation(validationValues, validatePaymentForm);

  function fieldError(index: number, field: "paymentAccountId" | "amount" | "reference") {
    return fieldErrors[`lines.${index}.${field}`];
  }

  function updateLine(index: number, patch: Partial<DraftPaymentLine>) {
    setLines((current) => current.map((line, lineIndex) => (lineIndex === index ? { ...line, ...patch } : line)));
  }

  function addLine() {
    setLines((current) => {
      const currentTotalMinor = current.reduce((sum, line) => sum + inputValueToMinor(line.amount), 0);
      const nextAmountMinor = Math.max(amountMinor - currentTotalMinor, 0);
      const lineId = nextLineId.current;
      nextLineId.current += 1;

      return [
        ...current,
        {
          key: `${idPrefix}-line-${lineId}`,
          paymentAccountId: "",
          amount: minorToInputValue(nextAmountMinor),
          reference: "",
          note: "",
        },
      ];
    });
  }

  function removeLine(index: number) {
    setLines((current) => current.filter((_, lineIndex) => lineIndex !== index));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (!isValid) {
      event.preventDefault();
    }
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button disabled={matchingAccounts.length === 0}>{triggerLabel}</Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl">
        <form action={action} onSubmit={handleSubmit} noValidate className="grid gap-5">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>

          <input type="hidden" name={hiddenFieldName} value={hiddenFieldValue} />

          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Method / Account</th>
                  <th className="px-3 py-2">Amount</th>
                  <th className="px-3 py-2">Reference</th>
                  <th className="px-3 py-2">Note</th>
                  <th className="w-12 px-3 py-2" aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {lines.map((line, index) => (
                  <tr key={line.key} className="border-t border-border align-top">
                    <td className="px-3 py-3">
                      <select
                        name="linePaymentAccountId"
                        required
                        value={line.paymentAccountId}
                        onChange={(event) => updateLine(index, { paymentAccountId: event.target.value })}
                        className={cn(
                          "h-10 w-full rounded-md border border-input bg-background px-3 text-sm",
                          fieldError(index, "paymentAccountId") ? "border-destructive focus-visible:ring-destructive/30" : null,
                        )}
                      >
                        <option value="" disabled>Select account</option>
                        {matchingAccounts.map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.paymentMethodName} / {account.code} / {account.name}
                          </option>
                        ))}
                      </select>
                      {fieldError(index, "paymentAccountId") ? (
                        <p className="mt-1 text-xs text-destructive">{fieldError(index, "paymentAccountId")}</p>
                      ) : null}
                    </td>
                    <td className="px-3 py-3">
                      <input
                        name="lineAmount"
                        type="number"
                        min="0.01"
                        step="0.01"
                        required
                        value={line.amount}
                        onChange={(event) => updateLine(index, { amount: event.target.value })}
                        className={cn(
                          "h-10 w-32 rounded-md border border-input bg-background px-3 text-sm",
                          fieldError(index, "amount") ? "border-destructive focus-visible:ring-destructive/30" : null,
                        )}
                      />
                      {fieldError(index, "amount") ? (
                        <p className="mt-1 max-w-36 text-xs text-destructive">{fieldError(index, "amount")}</p>
                      ) : null}
                    </td>
                    <td className="px-3 py-3">
                      <input
                        name="lineReference"
                        value={line.reference}
                        onChange={(event) => updateLine(index, { reference: event.target.value })}
                        className={cn(
                          "h-10 w-full rounded-md border border-input bg-background px-3 text-sm",
                          fieldError(index, "reference") ? "border-destructive focus-visible:ring-destructive/30" : null,
                        )}
                      />
                      {fieldError(index, "reference") ? (
                        <p className="mt-1 text-xs text-destructive">{fieldError(index, "reference")}</p>
                      ) : null}
                    </td>
                    <td className="px-3 py-3">
                      <input
                        name="lineNote"
                        value={line.note}
                        onChange={(event) => updateLine(index, { note: event.target.value })}
                        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      />
                    </td>
                    <td className="px-3 py-3">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={lines.length === 1}
                        onClick={() => removeLine(index)}
                      >
                        <Trash2Icon className="size-4" />
                        <span className="sr-only">Remove line</span>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button type="button" variant="outline" onClick={addLine}>
              <PlusIcon className="size-4" />
              Add line
            </Button>
            <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
              <span className="text-muted-foreground">Entered </span>
              <span className="font-semibold">{currencyCode} {minorToInputValue(enteredAmountMinor)}</span>
              <span className="mx-2 text-muted-foreground">/</span>
              <span className="text-muted-foreground">Remaining </span>
              <span className="font-semibold">{currencyCode} {minorToInputValue(remainingAmountMinor)}</span>
            </div>
          </div>

          {matchingAccounts.length === 0 ? (
            <p className="text-sm text-destructive">
              No active payment account exists for {currencyCode}.
            </p>
          ) : null}
          {formErrors.length > 0 ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {formErrors.map((error) => (
                <p key={error}>{error}</p>
              ))}
            </div>
          ) : null}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancel</Button>
            </DialogClose>
            <Button type="submit" disabled={matchingAccounts.length === 0}>
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
