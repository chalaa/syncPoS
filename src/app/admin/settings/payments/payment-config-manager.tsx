"use client";

import { EditIcon, PlusIcon, RotateCcwIcon, SearchIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Alert } from "@/components/ui/alert";
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
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import type { PaymentAccountRow, PaymentMethodOption, PaymentMethodRow } from "@/server/payments/types";

type PaymentMutation = (formData: FormData) => Promise<void>;

type PaymentConfigManagerProps = {
  tab: "methods" | "accounts";
  methods: PaymentMethodRow[];
  accounts: PaymentAccountRow[];
  methodOptions: PaymentMethodOption[];
  query: string;
  showDeleted: boolean;
  notice?: string;
  error?: string;
  returnPath: string;
  createMethodAction: PaymentMutation;
  updateMethodAction: PaymentMutation;
  deleteMethodAction: PaymentMutation;
  restoreMethodAction: PaymentMutation;
  createAccountAction: PaymentMutation;
  updateAccountAction: PaymentMutation;
  deleteAccountAction: PaymentMutation;
  restoreAccountAction: PaymentMutation;
};

const inputClass =
  "h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";
const textareaClass =
  "min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

function methodTypeLabel(value: string) {
  return value.replace(/_/g, " ");
}

function displayPaymentMoney(value: number, currencyCode: string) {
  return `${currencyCode} ${(value / 100).toFixed(2)}`;
}

function directions(method: PaymentMethodRow) {
  if (method.allowInbound && method.allowOutbound) {
    return "Inbound / Outbound";
  }

  return method.allowInbound ? "Inbound" : "Outbound";
}

function MethodForm({
  title,
  action,
  record,
  returnPath,
}: {
  title: string;
  action: PaymentMutation;
  record?: PaymentMethodRow;
  returnPath: string;
}) {
  return (
    <form action={action} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>Define how payments can be received or paid out.</DialogDescription>
      </DialogHeader>

      <input type="hidden" name="returnPath" value={returnPath} />
      {record ? <input type="hidden" name="id" value={record.id} /> : null}

      <div className="grid gap-4 sm:grid-cols-[0.7fr_1fr]">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Code
          <input name="code" placeholder={record ? undefined : "Auto"} defaultValue={record?.code} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Name
          <input name="name" required defaultValue={record?.name} className={inputClass} />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Type
        <select name="methodType" required defaultValue={record?.methodType ?? "cash"} className={inputClass}>
          <option value="cash">Cash</option>
          <option value="bank_transfer">Bank transfer</option>
          <option value="mobile_money">Mobile money</option>
          <option value="card">Card</option>
        </select>
      </label>

      <div className="grid gap-3 rounded-md border border-border p-3">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" name="allowInbound" defaultChecked={record?.allowInbound ?? true} className="size-4 rounded border-input" />
          Allow inbound customer payments
        </label>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" name="allowOutbound" defaultChecked={record?.allowOutbound ?? false} className="size-4 rounded border-input" />
          Allow outbound supplier/expense payments
        </label>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" name="requiresReference" defaultChecked={record?.requiresReference ?? false} className="size-4 rounded border-input" />
          Require payment reference
        </label>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" name="isActive" defaultChecked={record?.isActive ?? true} className="size-4 rounded border-input" />
          Active
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Notes
        <textarea name="notes" defaultValue={record?.notes ?? ""} className={textareaClass} />
      </label>

      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">Cancel</Button>
        </DialogClose>
        <Button>{record ? "Save changes" : "Create"}</Button>
      </DialogFooter>
    </form>
  );
}

function AccountForm({
  title,
  action,
  record,
  methods,
  returnPath,
}: {
  title: string;
  action: PaymentMutation;
  record?: PaymentAccountRow;
  methods: PaymentMethodOption[];
  returnPath: string;
}) {
  return (
    <form action={action} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>Define the cash drawer, bank, wallet, or card account used for payment posting.</DialogDescription>
      </DialogHeader>

      <input type="hidden" name="returnPath" value={returnPath} />
      {record ? <input type="hidden" name="id" value={record.id} /> : null}

      <label className="flex flex-col gap-1 text-sm font-medium">
        Payment method
        <select name="paymentMethodId" required defaultValue={record?.paymentMethodId ?? ""} className={inputClass}>
          <option value="">Select method</option>
          {methods.map((method) => (
            <option key={method.id} value={method.id}>
              {method.code} / {method.name}
            </option>
          ))}
        </select>
      </label>

      <div className="grid gap-4 sm:grid-cols-[0.7fr_1fr]">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Code
          <input name="code" placeholder={record ? undefined : "Auto"} defaultValue={record?.code} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Name
          <input name="name" required defaultValue={record?.name} className={inputClass} />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Institution
          <input name="institutionName" defaultValue={record?.institutionName ?? ""} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Account number
          <input name="accountNumber" defaultValue={record?.accountNumber ?? ""} className={inputClass} />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Opening balance
        <input
          name="openingBalance"
          type="number"
          step="0.01"
          defaultValue={record ? String(record.openingBalanceMinor / 100) : "0"}
          className={inputClass}
        />
      </label>

      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" name="isActive" defaultChecked={record?.isActive ?? true} className="size-4 rounded border-input" />
        Active
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Notes
        <textarea name="notes" defaultValue={record?.notes ?? ""} className={textareaClass} />
      </label>

      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">Cancel</Button>
        </DialogClose>
        <Button>{record ? "Save changes" : "Create"}</Button>
      </DialogFooter>
    </form>
  );
}

function MethodDialog({
  label,
  action,
  record,
  returnPath,
  children,
}: {
  label: string;
  action: PaymentMutation;
  record?: PaymentMethodRow;
  returnPath: string;
  children: ReactNode;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <MethodForm title={label} action={action} record={record} returnPath={returnPath} />
      </DialogContent>
    </Dialog>
  );
}

function AccountDialog({
  label,
  action,
  record,
  methods,
  returnPath,
  children,
}: {
  label: string;
  action: PaymentMutation;
  record?: PaymentAccountRow;
  methods: PaymentMethodOption[];
  returnPath: string;
  children: ReactNode;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <AccountForm title={label} action={action} record={record} methods={methods} returnPath={returnPath} />
      </DialogContent>
    </Dialog>
  );
}

export function PaymentConfigManager({
  tab,
  methods,
  accounts,
  methodOptions,
  query,
  showDeleted,
  notice,
  error,
  returnPath,
  createMethodAction,
  updateMethodAction,
  deleteMethodAction,
  restoreMethodAction,
  createAccountAction,
  updateAccountAction,
  deleteAccountAction,
  restoreAccountAction,
}: PaymentConfigManagerProps) {
  const methodTab = tab === "methods";

  return (
    <PageShell>
      <PageHeader
        eyebrow="Settings"
        title="Payment Configuration"
        actions={
          methodTab ? (
            <MethodDialog label="New payment method" action={createMethodAction} returnPath={returnPath}>
              <Button>
                <PlusIcon data-icon="inline-start" />
                New method
              </Button>
            </MethodDialog>
          ) : (
            <AccountDialog label="New payment account" action={createAccountAction} methods={methodOptions} returnPath={returnPath}>
              <Button>
                <PlusIcon data-icon="inline-start" />
                New account
              </Button>
            </AccountDialog>
          )
        }
      />

      {notice ? <Alert kind="success">{notice}</Alert> : null}
      {error ? <Alert kind="error">{error}</Alert> : null}

      <section className="rounded-lg border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
          <div className="flex rounded-md border border-border bg-muted p-1 text-sm">
            <Button asChild variant={methodTab ? "secondary" : "ghost"} size="sm">
              <Link href="/admin/settings/payments">Methods</Link>
            </Button>
            <Button asChild variant={!methodTab ? "secondary" : "ghost"} size="sm">
              <Link href="/admin/settings/payments?tab=accounts">Accounts</Link>
            </Button>
          </div>
          <form className="flex min-w-0 flex-1 gap-2 sm:max-w-xl">
            {!methodTab ? <input type="hidden" name="tab" value="accounts" /> : null}
            {showDeleted ? <input type="hidden" name="show" value="deleted" /> : null}
            <input
              name="q"
              defaultValue={query}
              placeholder={methodTab ? "Search method code, name, or notes" : "Search account code, name, institution, or number"}
              className="h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm"
            />
            <Button variant="outline">
              <SearchIcon data-icon="inline-start" />
              Search
            </Button>
          </form>
          <div className="flex rounded-md border border-border bg-muted p-1 text-sm">
            <Button asChild variant={!showDeleted ? "secondary" : "ghost"} size="sm">
              <Link href={methodTab ? "/admin/settings/payments" : "/admin/settings/payments?tab=accounts"}>Active</Link>
            </Button>
            <Button asChild variant={showDeleted ? "secondary" : "ghost"} size="sm">
              <Link href={methodTab ? "/admin/settings/payments?show=deleted" : "/admin/settings/payments?tab=accounts&show=deleted"}>Deleted</Link>
            </Button>
          </div>
        </div>

        {methodTab ? (
          <MethodTable
            records={methods}
            showDeleted={showDeleted}
            returnPath={returnPath}
            updateAction={updateMethodAction}
            deleteAction={deleteMethodAction}
            restoreAction={restoreMethodAction}
          />
        ) : (
          <AccountTable
            records={accounts}
            methods={methodOptions}
            showDeleted={showDeleted}
            returnPath={returnPath}
            updateAction={updateAccountAction}
            deleteAction={deleteAccountAction}
            restoreAction={restoreAccountAction}
          />
        )}
      </section>
    </PageShell>
  );
}

function MethodTable({
  records,
  showDeleted,
  returnPath,
  updateAction,
  deleteAction,
  restoreAction,
}: {
  records: PaymentMethodRow[];
  showDeleted: boolean;
  returnPath: string;
  updateAction: PaymentMutation;
  deleteAction: PaymentMutation;
  restoreAction: PaymentMutation;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[980px] text-left text-sm">
        <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-3">Method</th>
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3">Direction</th>
            <th className="px-4 py-3">Reference</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr key={record.id} className="border-t border-border">
              <td className="px-4 py-3">
                <div className="font-medium">{record.code} / {record.name}</div>
                <div className="text-xs text-muted-foreground">{record.notes || "No notes"}</div>
              </td>
              <td className="px-4 py-3 capitalize">{methodTypeLabel(record.methodType)}</td>
              <td className="px-4 py-3">{directions(record)}</td>
              <td className="px-4 py-3">{record.requiresReference ? "Required" : "Optional"}</td>
              <td className="px-4 py-3">{record.isActive ? "Active" : "Inactive"}</td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-2">
                  {!showDeleted ? (
                    <>
                      <MethodDialog label={`Edit ${record.name}`} action={updateAction} record={record} returnPath={returnPath}>
                        <Button variant="outline" size="sm">
                          <EditIcon data-icon="inline-start" />
                          Edit
                        </Button>
                      </MethodDialog>
                      <form action={deleteAction}>
                        <input type="hidden" name="id" value={record.id} />
                        <input type="hidden" name="returnPath" value={returnPath} />
                        <Button variant="destructive" size="sm">
                          <Trash2Icon data-icon="inline-start" />
                          Delete
                        </Button>
                      </form>
                    </>
                  ) : (
                    <form action={restoreAction}>
                      <input type="hidden" name="id" value={record.id} />
                      <input type="hidden" name="returnPath" value={returnPath} />
                      <Button variant="outline" size="sm">
                        <RotateCcwIcon data-icon="inline-start" />
                        Restore
                      </Button>
                    </form>
                  )}
                </div>
              </td>
            </tr>
          ))}
          {records.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">No payment methods found.</td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function AccountTable({
  records,
  methods,
  showDeleted,
  returnPath,
  updateAction,
  deleteAction,
  restoreAction,
}: {
  records: PaymentAccountRow[];
  methods: PaymentMethodOption[];
  showDeleted: boolean;
  returnPath: string;
  updateAction: PaymentMutation;
  deleteAction: PaymentMutation;
  restoreAction: PaymentMutation;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1040px] text-left text-sm">
        <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-3">Account</th>
            <th className="px-4 py-3">Method</th>
            <th className="px-4 py-3">Institution</th>
            <th className="px-4 py-3 text-right">Opening</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr key={record.id} className="border-t border-border">
              <td className="px-4 py-3">
                <div className="font-medium">{record.code} / {record.name}</div>
                <div className="text-xs text-muted-foreground">{record.notes || "No notes"}</div>
              </td>
              <td className="px-4 py-3">
                <div>{record.paymentMethodName}</div>
                <div className="text-xs capitalize text-muted-foreground">{methodTypeLabel(record.paymentMethodType)}</div>
              </td>
              <td className="px-4 py-3">
                <div>{record.institutionName ?? "-"}</div>
                <div className="text-xs text-muted-foreground">{record.accountNumber ?? "-"}</div>
              </td>
              <td className="px-4 py-3 text-right">{displayPaymentMoney(record.openingBalanceMinor, record.currencyCode)}</td>
              <td className="px-4 py-3">{record.isActive ? "Active" : "Inactive"}</td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-2">
                  {!showDeleted ? (
                    <>
                      <AccountDialog label={`Edit ${record.name}`} action={updateAction} record={record} methods={methods} returnPath={returnPath}>
                        <Button variant="outline" size="sm">
                          <EditIcon data-icon="inline-start" />
                          Edit
                        </Button>
                      </AccountDialog>
                      <form action={deleteAction}>
                        <input type="hidden" name="id" value={record.id} />
                        <input type="hidden" name="returnPath" value={returnPath} />
                        <Button variant="destructive" size="sm">
                          <Trash2Icon data-icon="inline-start" />
                          Delete
                        </Button>
                      </form>
                    </>
                  ) : (
                    <form action={restoreAction}>
                      <input type="hidden" name="id" value={record.id} />
                      <input type="hidden" name="returnPath" value={returnPath} />
                      <Button variant="outline" size="sm">
                        <RotateCcwIcon data-icon="inline-start" />
                        Restore
                      </Button>
                    </form>
                  )}
                </div>
              </td>
            </tr>
          ))}
          {records.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">No payment accounts found.</td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
