"use client";

import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Building2,
  CheckCircle2,
  CreditCard,
  Hash,
  Landmark,
  Loader2,
  MessageSquare,
  PlusIcon,
  ReceiptText,
  Trash2Icon,
  Wallet,
  X,
} from "lucide-react";
import Link from "next/link";
import { Fragment, useCallback, useId, useMemo, useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useFormValidation, type FormValidationResult } from "@/hooks/use-form-validation";
import { cn } from "@/lib/utils";
import type { PaymentAccountOption, PaymentLineRow } from "@/server/payments/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PaymentFormAction = (formData: FormData) => Promise<void>;

export type PaymentFormDialogProps = {
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
  disabled?: boolean;
  triggerVariant?: "default" | "outline" | "secondary" | "ghost";
  triggerClassName?: string;
  verifyAction?: PaymentFormAction;
  returnPath?: string;
};

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function minorToDisplay(value: number, code: string) {
  return `${code} ${(value / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function minorToInputValue(value: number) {
  return (value / 100).toFixed(2);
}

function inputValueToMinor(value: string) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

const METHOD_ICONS: Record<string, React.ElementType> = {
  cash: Wallet,
  bank_transfer: Landmark,
  mobile_money: CreditCard,
  card: CreditCard,
};

function MethodIcon({ type, className }: { type?: string; className?: string }) {
  const Icon = METHOD_ICONS[type ?? ""] ?? CreditCard;
  return <Icon className={className} />;
}

// ---------------------------------------------------------------------------
// Step indicator
// ---------------------------------------------------------------------------

function StepIndicator({ step }: { step: 1 | 2 }) {
  return (
    <div className="flex items-center gap-0 px-6 pt-5 pb-1">
      {/* Step 1 */}
      <div className="flex items-center gap-2">
        <div
          className={cn(
            "flex size-7 items-center justify-center rounded-full text-xs font-bold ring-2 transition-all",
            step === 1
              ? "bg-[#0B5D4B] text-white ring-[#0B5D4B]/30"
              : "bg-[#0B5D4B] text-white ring-[#0B5D4B]/20",
          )}
        >
          {step > 1 ? <CheckCircle2 className="size-4" /> : "1"}
        </div>
        <span
          className={cn(
            "text-xs font-semibold transition-colors",
            step === 1 ? "text-foreground" : "text-[#0B5D4B]",
          )}
        >
          Payment Details
        </span>
      </div>

      {/* Connector */}
      <div className="mx-3 h-px flex-1 bg-border" />

      {/* Step 2 */}
      <div className="flex items-center gap-2">
        <div
          className={cn(
            "flex size-7 items-center justify-center rounded-full text-xs font-bold ring-2 transition-all",
            step === 2
              ? "bg-[#0B5D4B] text-white ring-[#0B5D4B]/30"
              : "bg-muted text-muted-foreground ring-border",
          )}
        >
          2
        </div>
        <span
          className={cn(
            "text-xs font-semibold transition-colors",
            step === 2 ? "text-foreground" : "text-muted-foreground",
          )}
        >
          Confirm &amp; Post
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 1: Payment lines editor
// ---------------------------------------------------------------------------

function PaymentLinesStep({
  lines,
  matchingAccounts,
  accountById,
  currencyCode,
  amountMinor,
  enteredAmountMinor,
  remainingAmountMinor,
  fieldErrors,
  formErrors,
  hasSubmitted,
  hiddenFieldName,
  hiddenFieldValue,
  onUpdateLine,
  onAddLine,
  onRemoveLine,
  onContinue,
}: {
  lines: DraftPaymentLine[];
  matchingAccounts: PaymentAccountOption[];
  accountById: Map<string, PaymentAccountOption>;
  currencyCode: string;
  amountMinor: number;
  enteredAmountMinor: number;
  remainingAmountMinor: number;
  fieldErrors: Record<string, string>;
  formErrors: string[];
  hasSubmitted: boolean;
  hiddenFieldName: string;
  hiddenFieldValue: string;
  onUpdateLine: (index: number, patch: Partial<DraftPaymentLine>) => void;
  onAddLine: () => void;
  onRemoveLine: (index: number) => void;
  onContinue: () => void;
}) {
  const noAccounts = matchingAccounts.length === 0;

  function fieldError(index: number, field: "paymentAccountId" | "amount" | "reference") {
    return hasSubmitted ? fieldErrors[`lines.${index}.${field}`] : undefined;
  }

  return (
    <div className="flex flex-col gap-5">
      {/* No account warning */}
      {noAccounts && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-300/70 bg-amber-50/80 dark:bg-amber-950/30 dark:border-amber-700/40 p-4">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700/40 mt-0.5">
            <AlertCircle className="size-4" />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-sm text-amber-900 dark:text-amber-200">
              No Active Payment Account for {currencyCode}
            </p>
            <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed mt-0.5">
              Configure a payment account under{" "}
              <Link
                href="/admin/settings/payments?tab=accounts"
                className="font-bold underline underline-offset-2 hover:text-amber-700 dark:hover:text-amber-200 transition-colors"
              >
                Settings › Payments
              </Link>{" "}
              to record transactions.
            </p>
          </div>
        </div>
      )}

      {/* Due amount banner */}
      <div className="flex items-center justify-between rounded-xl border border-border bg-muted/30 px-4 py-3">
        <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
          <ReceiptText className="size-4 shrink-0" />
          <span>Total due</span>
        </div>
        <span className="font-mono text-lg font-extrabold text-foreground">
          {minorToDisplay(amountMinor, currencyCode)}
        </span>
      </div>

      {/* Payment lines */}
      <div className="flex flex-col gap-3">
        {lines.map((line, index) => {
          const account = accountById.get(line.paymentAccountId);
          const methodType = account
            ? matchingAccounts.find((a) => a.id === account.id)?.paymentMethodName
            : undefined;

          return (
            <div
              key={line.key}
              className="rounded-xl border border-border bg-card p-4 shadow-xs transition-all"
            >
              {/* Line header */}
              <div className="mb-3.5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="flex size-7 items-center justify-center rounded-lg bg-[#0B5D4B]/10 text-[#0B5D4B] dark:text-emerald-400">
                    <MethodIcon type={account ? matchingAccounts.find(a => a.id === account.id)?.paymentMethodName?.toLowerCase().replace(/\s+/g, "_") : undefined} className="size-3.5" />
                  </div>
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Payment Line {index + 1}
                  </span>
                </div>
                {lines.length > 1 && (
                  <button
                    type="button"
                    onClick={() => onRemoveLine(index)}
                    className="flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    aria-label="Remove line"
                  >
                    <Trash2Icon className="size-3.5" />
                  </button>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {/* Account */}
                <div className="sm:col-span-2">
                  <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-foreground/80">
                    <Building2 className="size-3" />
                    Payment Account
                  </label>
                  <select
                    name="linePaymentAccountId"
                    required
                    value={line.paymentAccountId}
                    onChange={(e) => onUpdateLine(index, { paymentAccountId: e.target.value })}
                    className={cn(
                      "h-10 w-full rounded-lg border bg-background px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B5D4B]/30 focus-visible:border-[#0B5D4B]",
                      fieldError(index, "paymentAccountId") ? "border-destructive" : "border-input",
                    )}
                  >
                    <option value="" disabled>
                      {noAccounts ? "No account available" : "Select account…"}
                    </option>
                    {matchingAccounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.paymentMethodName} · {acc.code} · {acc.name}
                      </option>
                    ))}
                  </select>
                  {fieldError(index, "paymentAccountId") && (
                    <p className="mt-1 text-xs text-destructive">{fieldError(index, "paymentAccountId")}</p>
                  )}
                </div>

                {/* Amount */}
                <div>
                  <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-foreground/80">
                    <Wallet className="size-3" />
                    Amount ({currencyCode})
                  </label>
                  <input
                    name="lineAmount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                    value={line.amount}
                    onChange={(e) => onUpdateLine(index, { amount: e.target.value })}
                    className={cn(
                      "h-10 w-full rounded-lg border bg-background px-3 text-sm font-mono transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B5D4B]/30 focus-visible:border-[#0B5D4B]",
                      fieldError(index, "amount") ? "border-destructive" : "border-input",
                    )}
                  />
                  {fieldError(index, "amount") && (
                    <p className="mt-1 text-xs text-destructive">{fieldError(index, "amount")}</p>
                  )}
                </div>

                {/* Reference */}
                <div>
                  <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-foreground/80">
                    <Hash className="size-3" />
                    Reference
                    {account && matchingAccounts.find(a => a.id === account.id)?.requiresReference && (
                      <span className="text-destructive ml-0.5">*</span>
                    )}
                  </label>
                  <input
                    name="lineReference"
                    value={line.reference}
                    onChange={(e) => onUpdateLine(index, { reference: e.target.value })}
                    placeholder="e.g. TXN-00123"
                    className={cn(
                      "h-10 w-full rounded-lg border bg-background px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B5D4B]/30 focus-visible:border-[#0B5D4B]",
                      fieldError(index, "reference") ? "border-destructive" : "border-input",
                    )}
                  />
                  {fieldError(index, "reference") && (
                    <p className="mt-1 text-xs text-destructive">{fieldError(index, "reference")}</p>
                  )}
                </div>

                {/* Note */}
                <div className="sm:col-span-2">
                  <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-foreground/80">
                    <MessageSquare className="size-3" />
                    Note <span className="font-normal text-muted-foreground">(optional)</span>
                  </label>
                  <input
                    name="lineNote"
                    value={line.note}
                    onChange={(e) => onUpdateLine(index, { note: e.target.value })}
                    placeholder="Internal note…"
                    className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B5D4B]/30 focus-visible:border-[#0B5D4B]"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add line button */}
      <button
        type="button"
        onClick={onAddLine}
        className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border py-2.5 text-xs font-semibold text-muted-foreground transition-all hover:border-[#0B5D4B]/40 hover:text-[#0B5D4B] dark:hover:text-emerald-400"
      >
        <PlusIcon className="size-3.5" />
        Add Payment Line
      </button>

      {/* Totals bar */}
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm transition-colors",
          remainingAmountMinor === 0
            ? "border-emerald-500/30 bg-emerald-500/8 dark:bg-emerald-950/30"
            : "border-border bg-muted/30",
        )}
      >
        <div className="flex items-center gap-4">
          <div>
            <span className="text-xs text-muted-foreground">Entered</span>
            <p className="font-mono font-bold text-foreground">{minorToDisplay(enteredAmountMinor, currencyCode)}</p>
          </div>
          <div className="h-8 w-px bg-border" />
          <div>
            <span className="text-xs text-muted-foreground">Remaining</span>
            <p
              className={cn(
                "font-mono font-bold",
                remainingAmountMinor === 0 ? "text-emerald-600 dark:text-emerald-400" : "text-foreground",
              )}
            >
              {minorToDisplay(remainingAmountMinor, currencyCode)}
            </p>
          </div>
        </div>
        {remainingAmountMinor === 0 && (
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="size-4" />
            Fully allocated
          </div>
        )}
      </div>

      {/* Form errors */}
      {hasSubmitted && formErrors.length > 0 && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
          {formErrors.map((err) => (
            <p key={err} className="flex items-center gap-1.5 text-xs font-medium text-destructive">
              <AlertCircle className="size-3.5 shrink-0" />
              {err}
            </p>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 border-t border-border pt-4">
        <Button
          type="button"
          onClick={onContinue}
          disabled={noAccounts}
          className="w-full sm:w-auto gap-2 bg-gradient-to-r from-[#0B5D4B] to-[#073B35] font-semibold text-white shadow-md shadow-[#0B5D4B]/20 hover:brightness-110 active:scale-[0.99] transition-all justify-center"
        >
          Review &amp; Post
          <ArrowRight className="size-4 text-emerald-200" />
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2: Review & Confirm
// ---------------------------------------------------------------------------

function ReviewStep({
  lines,
  matchingAccounts,
  currencyCode,
  amountMinor,
  enteredAmountMinor,
  isPending,
  submitLabel,
  hiddenFieldName,
  hiddenFieldValue,
  onBack,
}: {
  lines: DraftPaymentLine[];
  matchingAccounts: PaymentAccountOption[];
  currencyCode: string;
  amountMinor: number;
  enteredAmountMinor: number;
  isPending: boolean;
  submitLabel: string;
  hiddenFieldName: string;
  hiddenFieldValue: string;
  onBack: () => void;
}) {
  const remainingMinor = Math.max(amountMinor - enteredAmountMinor, 0);

  return (
    <div className="flex flex-col gap-5">
      {/* Summary header */}
      <div className="flex items-center gap-3 rounded-xl border border-[#0B5D4B]/20 bg-[#0B5D4B]/5 dark:bg-[#0B5D4B]/10 px-4 py-3.5">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#0B5D4B]/15 text-[#0B5D4B] dark:text-emerald-400">
          <BadgeCheck className="size-5" />
        </div>
        <div>
          <p className="text-sm font-bold text-foreground">Confirm &amp; Post Payment</p>
          <p className="text-xs text-muted-foreground">
            Please verify all details. Confirming will post the payment immediately.
          </p>
        </div>
      </div>

      {/* Lines review */}
      <div className="flex flex-col gap-2.5">
        {lines.map((line, index) => {
          const account = matchingAccounts.find((a) => a.id === line.paymentAccountId);
          return (
            <div
              key={line.key}
              className="rounded-xl border border-border bg-card px-4 py-3.5 shadow-xs"
            >
              <div className="mb-3 flex items-center gap-2">
                <div className="flex size-6 items-center justify-center rounded-md bg-[#0B5D4B]/10 text-[#0B5D4B] dark:text-emerald-400">
                  <MethodIcon className="size-3.5" />
                </div>
                <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Line {index + 1}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm sm:grid-cols-3">
                <div>
                  <p className="text-[11px] font-medium uppercase text-muted-foreground">Method</p>
                  <p className="mt-0.5 font-semibold text-foreground">{account?.paymentMethodName ?? "—"}</p>
                </div>
                <div>
                  <p className="text-[11px] font-medium uppercase text-muted-foreground">Account</p>
                  <p className="mt-0.5 font-semibold text-foreground">{account ? `${account.code} · ${account.name}` : "—"}</p>
                </div>
                <div>
                  <p className="text-[11px] font-medium uppercase text-muted-foreground">Amount</p>
                  <p className="mt-0.5 font-mono font-extrabold text-foreground">
                    {minorToDisplay(inputValueToMinor(line.amount), currencyCode)}
                  </p>
                </div>
                {line.reference && (
                  <div>
                    <p className="text-[11px] font-medium uppercase text-muted-foreground">Reference</p>
                    <p className="mt-0.5 font-semibold text-foreground">{line.reference}</p>
                  </div>
                )}
                {line.note && (
                  <div className="col-span-2">
                    <p className="text-[11px] font-medium uppercase text-muted-foreground">Note</p>
                    <p className="mt-0.5 font-medium text-foreground">{line.note}</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Totals */}
      <div className="rounded-xl border border-border bg-muted/30 px-4 py-3.5">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Amount due</span>
          <span className="font-mono font-bold text-foreground">{minorToDisplay(amountMinor, currencyCode)}</span>
        </div>
        <div className="mt-2 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Payment total</span>
          <span className="font-mono font-bold text-foreground">{minorToDisplay(enteredAmountMinor, currencyCode)}</span>
        </div>
        <div className="mt-2 border-t border-border/60 pt-2 flex items-center justify-between text-sm">
          <span className="font-medium text-muted-foreground">Remaining</span>
          <span
            className={cn(
              "font-mono font-extrabold",
              remainingMinor === 0 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400",
            )}
          >
            {minorToDisplay(remainingMinor, currencyCode)}
          </span>
        </div>
      </div>

      {/* Hidden fields for form submission */}
      <input type="hidden" name={hiddenFieldName} value={hiddenFieldValue} />
      {lines.map((line, idx) => (
        <Fragment key={line.key || idx}>
          <input type="hidden" name="linePaymentAccountId" value={line.paymentAccountId} />
          <input type="hidden" name="lineAmount" value={line.amount} />
          <input type="hidden" name="lineReference" value={line.reference} />
          <input type="hidden" name="lineNote" value={line.note} />
        </Fragment>
      ))}
      {lines[0] && (
        <Fragment>
          <input type="hidden" name="paymentAccountId" value={lines[0].paymentAccountId} />
          <input type="hidden" name="amount" value={lines[0].amount} />
          <input type="hidden" name="reference" value={lines[0].reference} />
          <input type="hidden" name="notes" value={lines[0].note} />
        </Fragment>
      )}

      {/* Actions */}
      <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5 border-t border-border pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          disabled={isPending}
          className="w-full sm:w-auto gap-2 text-muted-foreground hover:text-foreground justify-center"
        >
          <ArrowLeft className="size-4" />
          Back
        </Button>

        <Button
          type="submit"
          disabled={isPending}
          className="w-full sm:w-auto gap-2 bg-gradient-to-r from-[#0B5D4B] to-[#073B35] font-semibold text-white shadow-md shadow-[#0B5D4B]/20 hover:brightness-110 active:scale-[0.99] transition-all justify-center"
        >
          {isPending ? (
            <>
              <Loader2 className="size-4 animate-spin text-emerald-200" />
              Posting Payment…
            </>
          ) : (
            <>
              <CheckCircle2 className="size-4 text-emerald-200" />
              {submitLabel || "Post Payment"}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

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
  disabled,
  triggerVariant,
  triggerClassName,
}: PaymentFormDialogProps) {
  const idPrefix = useId();
  const nextLineId = useRef(2);
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [step, setStep] = useState<1 | 2>(1);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [open, setOpen] = useState(false);

  const matchingAccounts = paymentAccounts.filter((a) => a.currencyCode === currencyCode);
  const accountById = useMemo(
    () => new Map(matchingAccounts.map((a) => [a.id, a])),
    [matchingAccounts],
  );

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
    const defaultAccountId = paymentAccountId ?? (matchingAccounts.length === 1 ? matchingAccounts[0].id : "");
    return [
      {
        key: `${idPrefix}-line-1`,
        paymentAccountId: defaultAccountId,
        amount: minorToInputValue(amountMinor),
        reference: reference ?? "",
        note: notes ?? "",
      },
    ];
  }, [amountMinor, idPrefix, matchingAccounts, notes, paymentAccountId, paymentLines, reference]);

  const [lines, setLines] = useState(initialLines);

  const enteredAmountMinor = lines.reduce((sum, l) => sum + inputValueToMinor(l.amount), 0);
  const remainingAmountMinor = Math.max(amountMinor - enteredAmountMinor, 0);

  const validatePaymentForm = useCallback(
    (values: PaymentValidationValues): FormValidationResult => {
      const fieldErrors: Record<string, string> = {};
      const formErrors: string[] = [];

      if (values.lines.length === 0) {
        formErrors.push("Add at least one payment line.");
      }

      values.lines.forEach((line, index) => {
        const account = values.accountById.get(line.paymentAccountId);
        const amount = Number.parseFloat(line.amount);

        if (!line.paymentAccountId) {
          fieldErrors[`lines.${index}.paymentAccountId`] = `Select a payment account on line ${index + 1}.`;
        } else if (!account) {
          fieldErrors[`lines.${index}.paymentAccountId`] = `Select an active account on line ${index + 1}.`;
        }

        if (!Number.isFinite(amount) || amount <= 0) {
          fieldErrors[`lines.${index}.amount`] = `Enter an amount > 0 on line ${index + 1}.`;
        }

        if (account?.requiresReference && !line.reference.trim()) {
          fieldErrors[`lines.${index}.reference`] = `Reference required on line ${index + 1}.`;
        }
      });

      const totalMinor = values.lines.reduce((sum, l) => sum + inputValueToMinor(l.amount), 0);
      if (totalMinor > values.targetAmountMinor) {
        formErrors.push("Payment lines cannot exceed the remaining amount.");
      }

      return { formErrors, fieldErrors };
    },
    [],
  );

  const validationValues = useMemo(
    () => ({ lines, targetAmountMinor: amountMinor, accountById }),
    [accountById, amountMinor, lines],
  );

  const { formErrors, fieldErrors, isValid } = useFormValidation(validationValues, validatePaymentForm);

  function updateLine(index: number, patch: Partial<DraftPaymentLine>) {
    setLines((cur) => cur.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function addLine() {
    setLines((cur) => {
      const currentTotal = cur.reduce((sum, l) => sum + inputValueToMinor(l.amount), 0);
      const nextAmount = Math.max(amountMinor - currentTotal, 0);
      const lineId = nextLineId.current++;
      return [
        ...cur,
        {
          key: `${idPrefix}-line-${lineId}`,
          paymentAccountId: matchingAccounts.length === 1 ? matchingAccounts[0].id : "",
          amount: minorToInputValue(nextAmount),
          reference: "",
          note: "",
        },
      ];
    });
  }

  function removeLine(index: number) {
    setLines((cur) => cur.filter((_, i) => i !== index));
  }

  function handleContinueToReview() {
    setHasSubmitted(true);
    if (!isValid || matchingAccounts.length === 0) return;
    setStep(2);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step === 1) {
      handleContinueToReview();
      return;
    }
    if (!isValid) return;
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      await action(formData);
      setOpen(false);
    });
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      // Reset on close
      setStep(1);
      setHasSubmitted(false);
      setLines(initialLines);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant={triggerVariant} className={triggerClassName} disabled={disabled}>
          {triggerLabel}
        </Button>
      </DialogTrigger>

      <DialogContent
        className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-1.5rem)] max-w-2xl max-h-[92vh] p-0 gap-0 flex flex-col rounded-2xl border border-border/80 bg-card shadow-2xl overflow-hidden outline-none"
        showCloseButton={false}
      >
        {/* Accent line */}
        <div className="h-1.5 w-full bg-gradient-to-r from-[#0B5D4B] via-[#073B35] to-[#D9A441] shrink-0" />

        {/* Header */}
        <DialogHeader className="shrink-0 border-b border-border/70 bg-background/95 px-4 sm:px-6 py-4 backdrop-blur-md flex flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#0B5D4B] to-[#073B35] text-white shadow-md shadow-[#0B5D4B]/25 ring-1 ring-white/20">
              <Landmark className="size-5 text-emerald-200" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-base font-bold tracking-tight text-foreground">
                {title}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                {description}
              </DialogDescription>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg p-1.5 sm:p-2 bg-red-500 text-white hover:bg-red-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50 shadow-2xs"
            aria-label="Close"
          >
            <X className="size-4 sm:size-4.5" />
          </button>
        </DialogHeader>

        {/* Step indicator */}
        <StepIndicator step={step} />

        {/* Body */}
        <form
          ref={formRef}
          onSubmit={handleSubmit}
          noValidate
          className="flex-1 overflow-y-auto px-6 pb-6 pt-4"
        >
          {step === 1 ? (
            <PaymentLinesStep
              lines={lines}
              matchingAccounts={matchingAccounts}
              accountById={accountById}
              currencyCode={currencyCode}
              amountMinor={amountMinor}
              enteredAmountMinor={enteredAmountMinor}
              remainingAmountMinor={remainingAmountMinor}
              fieldErrors={fieldErrors}
              formErrors={formErrors}
              hasSubmitted={hasSubmitted}
              hiddenFieldName={hiddenFieldName}
              hiddenFieldValue={hiddenFieldValue}
              onUpdateLine={updateLine}
              onAddLine={addLine}
              onRemoveLine={removeLine}
              onContinue={handleContinueToReview}
            />
          ) : (
            <ReviewStep
              lines={lines}
              matchingAccounts={matchingAccounts}
              currencyCode={currencyCode}
              amountMinor={amountMinor}
              enteredAmountMinor={enteredAmountMinor}
              isPending={isPending}
              submitLabel={submitLabel}
              hiddenFieldName={hiddenFieldName}
              hiddenFieldValue={hiddenFieldValue}
              onBack={() => setStep(1)}
            />
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}

function VerificationStatus({
  status,
  message,
}: {
  status: string;
  message: string | null;
}) {
  const label = status.replace(/_/g, " ");
  const className = status === "verified"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : status === "failed"
      ? "border-destructive/30 bg-destructive/5 text-destructive"
      : "border-border bg-muted/40 text-muted-foreground";

  return (
    <span title={message ?? undefined} className={`w-fit rounded-md border px-2 py-1 text-xs font-medium capitalize ${className}`}>
      {label}
    </span>
  );
}
