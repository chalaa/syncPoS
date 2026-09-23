"use client";

import { EditIcon, PlusIcon, RotateCcwIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Alert } from "@/components/ui/alert";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DeleteConfirmationDialog } from "@/components/ui/delete-confirmation-dialog";
import { TableSearchInput } from "@/components/ui/table-search-input";
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
import { useTranslation } from "@/lib/i18n/use-translation";
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
  const { t } = useTranslation();
  return (
    <form action={action} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{t("payment.methodModalDesc", "Define how payments can be received or paid out.")}</DialogDescription>
      </DialogHeader>

      <input type="hidden" name="returnPath" value={returnPath} />
      {record ? <input type="hidden" name="id" value={record.id} /> : null}

      <label className="flex flex-col gap-1 text-sm font-medium">
        {t("field.name", "Name")}
        <input name="name" required defaultValue={record?.name} className={inputClass} />
      </label>
      {record ? <input type="hidden" name="code" value={record.code} /> : null}

      <label className="flex flex-col gap-1 text-sm font-medium">
        {t("field.type", "Type")}
        <select name="methodType" required defaultValue={record?.methodType ?? "cash"} className={inputClass}>
          <option value="cash">{t("status.cash")}</option>
          <option value="bank_transfer">{t("status.bank_transfer")}</option>
          <option value="mobile_money">{t("status.mobile_money")}</option>
          <option value="card">{t("status.card")}</option>
        </select>
      </label>

      <div className="grid gap-3 rounded-md border border-border p-3">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" name="allowInbound" defaultChecked={record?.allowInbound ?? true} className="size-4 rounded border-input" />
          {t("payment.allowInbound", "Allow inbound customer payments")}
        </label>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" name="allowOutbound" defaultChecked={record?.allowOutbound ?? false} className="size-4 rounded border-input" />
          {t("payment.allowOutbound", "Allow outbound supplier/expense payments")}
        </label>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" name="requiresReference" defaultChecked={record?.requiresReference ?? false} className="size-4 rounded border-input" />
          {t("payment.requireReference", "Require payment reference")}
        </label>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" name="isActive" defaultChecked={record?.isActive ?? true} className="size-4 rounded border-input" />
          {t("field.active", "Active")}
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm font-medium">
        {t("field.notes", "Notes")}
        <textarea name="notes" defaultValue={record?.notes ?? ""} className={textareaClass} />
      </label>

      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">{t("action.cancel")}</Button>
        </DialogClose>
        <Button>{record ? t("Save changes") : t("action.create")}</Button>
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
  const { t } = useTranslation();
  return (
    <form action={action} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>
          {t("payment.accountModalDesc", "Define the cash drawer, bank, wallet, or card account used for payment posting.")}
        </DialogDescription>
      </DialogHeader>

      <input type="hidden" name="returnPath" value={returnPath} />
      {record ? <input type="hidden" name="id" value={record.id} /> : null}

      <label className="flex flex-col gap-1 text-sm font-medium">
        {t("payment.paymentMethod", "Payment method")}
        <select name="paymentMethodId" required defaultValue={record?.paymentMethodId ?? ""} className={inputClass}>
          <option value="">{t("payment.selectMethod", "Select method")}</option>
          {methods.map((method) => (
            <option key={method.id} value={method.id}>
              {method.code} / {method.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium">
        {t("field.name", "Name")}
        <input name="name" required defaultValue={record?.name} className={inputClass} />
      </label>
      {record ? <input type="hidden" name="code" value={record.code} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t("payment.institution", "Institution")}
          <input name="institutionName" defaultValue={record?.institutionName ?? ""} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t("payment.accountNumber", "Account number")}
          <input name="accountNumber" defaultValue={record?.accountNumber ?? ""} className={inputClass} />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm font-medium">
        {t("payment.openingBalance", "Opening balance")}
        <input
          name="openingBalance"
          type="number"
          step="0.01"
          defaultValue={record ? String(record.openingBalanceMinor / 100) : "0"}
          className={inputClass}
        />
      </label>

      <div className="grid gap-4 rounded-md border border-border bg-muted/20 p-3">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            name="verifyEtEnabled"
            defaultChecked={record?.verifyEtEnabled ?? false}
            className="size-4 rounded border-input"
          />
          {t("payment.verifyEtCheckbox", "Verify references with Verify.ET")}
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm font-medium">
            {t("payment.verifyEtBank", "Verify.ET bank")}
            <select name="verifyEtBank" defaultValue={record?.verifyEtBank ?? ""} className={inputClass}>
              <option value="">{t("payment.noBankSelected", "No bank selected")}</option>
              <option value="cbe">CBE</option>
              <option value="boa">Bank of Abyssinia</option>
              <option value="telebirr">Telebirr</option>
              <option value="mpesa">M-Pesa</option>
              <option value="cbebirr">CBE Birr</option>
              <option value="dashen">Dashen</option>
              <option value="awash">Awash</option>
              <option value="siinqee">Siinqee</option>
              <option value="kaafiebirr">Kaafi eBirr</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            {t("payment.settlementAccount", "Settlement account")}
            <input
              name="verifyEtSettlementAccount"
              defaultValue={record?.verifyEtSettlementAccount ?? ""}
              placeholder={t("payment.settlementAccountPlaceholder", "Receiver account or wallet phone")}
              className={inputClass}
            />
          </label>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" name="isActive" defaultChecked={record?.isActive ?? true} className="size-4 rounded border-input" />
        {t("field.active", "Active")}
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium">
        {t("field.notes", "Notes")}
        <textarea name="notes" defaultValue={record?.notes ?? ""} className={textareaClass} />
      </label>

      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">{t("action.cancel")}</Button>
        </DialogClose>
        <Button>{record ? t("Save changes") : t("action.create")}</Button>
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
  const { t } = useTranslation();
  const methodTab = tab === "methods";

  return (
    <PageShell>
      <PageHeader
        eyebrow="Settings"
        title="Payment Configuration"
        actions={
          methodTab ? (
            <MethodDialog label={t("payment.newMethod", "New payment method")} action={createMethodAction} returnPath={returnPath}>
              <Button>
                <PlusIcon data-icon="inline-start" />
                {t("payment.newMethodShort", "New method")}
              </Button>
            </MethodDialog>
          ) : (
            <AccountDialog label={t("payment.newAccount", "New payment account")} action={createAccountAction} methods={methodOptions} returnPath={returnPath}>
              <Button>
                <PlusIcon data-icon="inline-start" />
                {t("payment.newAccountShort", "New account")}
              </Button>
            </AccountDialog>
          )
        }
      />

      {notice ? <Alert kind="success">{notice}</Alert> : null}
      {error ? <Alert kind="error">{error}</Alert> : null}

      <section className="rounded-xl border border-border bg-card shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
          <div className="flex rounded-lg border border-border bg-muted/60 p-1 text-sm">
            <Button asChild variant={methodTab ? "secondary" : "ghost"} size="sm" className="h-7 text-xs">
              <Link href="/admin/settings/payments">{t("payment.methods", "Methods")}</Link>
            </Button>
            <Button asChild variant={!methodTab ? "secondary" : "ghost"} size="sm" className="h-7 text-xs">
              <Link href="/admin/settings/payments?tab=accounts">{t("payment.accounts", "Accounts")}</Link>
            </Button>
          </div>
          <TableSearchInput
            defaultValue={query}
            placeholder={
              methodTab
                ? t("payment.searchMethods", "Search method code, name, or notes...")
                : t("payment.searchAccounts", "Search account code, name, institution, or number...")
            }
            className="sm:max-w-xl"
          />
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
  const { t } = useTranslation();
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[980px] text-left text-sm">
        <thead className="border-b border-border bg-muted/50 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-4 py-3">{t("payment.methodCol", "Method")}</th>
            <th className="px-4 py-3">{t("field.type", "Type")}</th>
            <th className="px-4 py-3">{t("payment.direction", "Direction")}</th>
            <th className="px-4 py-3">{t("Reference", "Reference")}</th>
            <th className="px-4 py-3">{t("payment.verification", "Verification")}</th>
            <th className="px-4 py-3">{t("field.status")}</th>
            <th className="px-4 py-3 text-right">{t("action.actions")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {records.map((record) => (
            <tr
              key={record.id}
              className="transition-colors hover:bg-[rgba(235,239,234,0.45)] dark:hover:bg-muted/30"
            >
              <td className="px-4 py-3">
                <div className="font-medium text-foreground">{record.code} / {record.name}</div>
                <div className="text-xs text-muted-foreground">{record.notes || t("payment.noNotes", "No notes")}</div>
              </td>
              <td className="px-4 py-3 capitalize text-foreground">{t(`status.${record.methodType}`, methodTypeLabel(record.methodType))}</td>
              <td className="px-4 py-3 text-foreground">{t(directions(record), directions(record))}</td>
              <td className="px-4 py-3 text-foreground">{record.requiresReference ? t("payment.required", "Required") : t("payment.optional", "Optional")}</td>
              <td className="px-4 py-3">
                <StatusBadge status={record.isActive ? "active" : "inactive"} />
              </td>
              <td className="px-4 py-3 text-right">
                <div className="flex justify-end gap-2">
                  {!showDeleted ? (
                    <>
                      <MethodDialog label={`${t("action.edit", "Edit")} ${record.name}`} action={updateAction} record={record} returnPath={returnPath}>
                        <Button variant="outline" size="sm" className="h-7 text-xs">
                          <EditIcon className="size-3.5" data-icon="inline-start" />
                          {t("action.edit", "Edit")}
                        </Button>
                      </MethodDialog>
                      <DeleteConfirmationDialog
                        action={deleteAction}
                        hiddenInputs={{ id: record.id, returnPath }}
                        itemName={record.name}
                      />
                    </>
                  ) : (
                    <form action={restoreAction}>
                      <input type="hidden" name="id" value={record.id} />
                      <input type="hidden" name="returnPath" value={returnPath} />
                      <Button variant="outline" size="sm" className="h-7 text-xs">
                        <RotateCcwIcon className="size-3.5" data-icon="inline-start" />
                        {t("action.restore", "Restore")}
                      </Button>
                    </form>
                  )}
                </div>
              </td>
            </tr>
          ))}
          {records.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">{t("payment.noMethodsFound", "No payment methods found.")}</td>
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
  const { t } = useTranslation();
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1040px] text-left text-sm">
        <thead className="border-b border-border bg-muted/50 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-4 py-3">{t("field.account", "Account")}</th>
            <th className="px-4 py-3">{t("payment.methodCol", "Method")}</th>
            <th className="px-4 py-3">{t("payment.institution", "Institution")}</th>
            <th className="px-4 py-3 text-right">{t("payment.opening", "Opening")}</th>
            <th className="px-4 py-3">{t("field.status")}</th>
            <th className="px-4 py-3 text-right">{t("action.actions")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {records.map((record) => (
            <tr
              key={record.id}
              className="transition-colors hover:bg-[rgba(235,239,234,0.45)] dark:hover:bg-muted/30"
            >
              <td className="px-4 py-3">
                <div className="font-medium text-foreground">{record.code} / {record.name}</div>
                <div className="text-xs text-muted-foreground">{record.notes || t("payment.noNotes", "No notes")}</div>
              </td>
              <td className="px-4 py-3">
                <div className="font-medium text-foreground">{record.paymentMethodName}</div>
                <div className="text-xs capitalize text-muted-foreground">{t(`status.${record.paymentMethodType}`, methodTypeLabel(record.paymentMethodType))}</div>
              </td>
              <td className="px-4 py-3 text-foreground">
                <div>{record.institutionName ?? "-"}</div>
                <div className="text-xs text-muted-foreground font-mono">{record.accountNumber ?? "-"}</div>
              </td>
              <td className="px-4 py-3 text-right">{displayPaymentMoney(record.openingBalanceMinor, record.currencyCode)}</td>
              <td className="px-4 py-3">
                {record.verifyEtEnabled ? (
                  <div>
                    <div className="font-medium">Verify.ET</div>
                    <div className="text-xs text-muted-foreground">{record.verifyEtBank ?? t("payment.noBank", "No bank")} / {record.verifyEtSettlementAccount ?? t("payment.noSettlement", "No settlement")}</div>
                  </div>
                ) : (
                  <span className="text-muted-foreground">{t("payment.notRequired", "Not required")}</span>
                )}
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={record.isActive ? "active" : "inactive"} />
              </td>
              <td className="px-4 py-3 text-right">
                <div className="flex justify-end gap-2">
                  {!showDeleted ? (
                    <>
                      <AccountDialog label={`${t("action.edit", "Edit")} ${record.name}`} action={updateAction} record={record} methods={methods} returnPath={returnPath}>
                        <Button variant="outline" size="sm" className="h-7 text-xs">
                          <EditIcon className="size-3.5" data-icon="inline-start" />
                          {t("action.edit", "Edit")}
                        </Button>
                      </AccountDialog>
                      <DeleteConfirmationDialog
                        action={deleteAction}
                        hiddenInputs={{ id: record.id, returnPath }}
                        itemName={record.name}
                      />
                    </>
                  ) : (
                    <form action={restoreAction}>
                      <input type="hidden" name="id" value={record.id} />
                      <input type="hidden" name="returnPath" value={returnPath} />
                      <Button variant="outline" size="sm" className="h-7 text-xs">
                        <RotateCcwIcon className="size-3.5" data-icon="inline-start" />
                        {t("action.restore", "Restore")}
                      </Button>
                    </form>
                  )}
                </div>
              </td>
            </tr>
          ))}
          {records.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">{t("payment.noAccountsFound", "No payment accounts found.")}</td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
