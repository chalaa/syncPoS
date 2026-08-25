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
import type { PaymentAccountOption } from "@/server/payments/types";

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
};

function minorToInputValue(value: number) {
  return (value / 100).toFixed(2);
}

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
}: PaymentFormDialogProps) {
  const matchingAccounts = paymentAccounts.filter((account) => account.currencyCode === currencyCode);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button disabled={matchingAccounts.length === 0}>{triggerLabel}</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <form action={action} className="grid gap-5">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>

          <input type="hidden" name={hiddenFieldName} value={hiddenFieldValue} />

          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm font-medium">
              Payment Account
              <select
                name="paymentAccountId"
                required
                defaultValue={paymentAccountId ?? ""}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="" disabled>Select account</option>
                {matchingAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.code} / {account.name} / {account.currencyCode}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Amount
              <input
                name="amount"
                type="number"
                min="0.01"
                step="0.01"
                required
                defaultValue={minorToInputValue(amountMinor)}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Reference
              <input
                name="reference"
                defaultValue={reference ?? ""}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Notes
              <input
                name="notes"
                defaultValue={notes ?? ""}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              />
            </label>
          </div>

          {matchingAccounts.length === 0 ? (
            <p className="text-sm text-destructive">
              No active payment account exists for {currencyCode}.
            </p>
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
