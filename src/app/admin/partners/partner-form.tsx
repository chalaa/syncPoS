import Link from "next/link";
import { ArrowUpRight, FileText, Receipt, ArrowLeft } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { T } from "@/components/ui/t";
import {
  addressTypeOptions,
  minorToDisplay,
  partnerStatusOptions,
} from "@/server/partners/partners";
import type { PartnerDetailRecord, PartnerFormRecord, PaymentTermOption } from "@/server/partners/types";
import { createPartner, updatePartner } from "./actions";

type PartnerFormProps = {
  mode: "create" | "edit";
  partner?: PartnerFormRecord | PartnerDetailRecord;
  paymentTerms: PaymentTermOption[];
  error?: string;
};

function hasFinancialSummary(partner?: PartnerFormRecord | PartnerDetailRecord): partner is PartnerDetailRecord {
  return Boolean(partner && "financial" in partner);
}

function money(value: number, currencyCode: string) {
  return `${currencyCode} ${minorToDisplay(value)}`;
}

function PartnerSmartSummary({ partner }: { partner: PartnerDetailRecord }) {
  return (
    <section className="mb-6 space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {partner.isCustomer ? (
          <Link
            href={`/admin/sales?view=invoices&partnerId=${partner.id}`}
            className="group flex items-center justify-between rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/50 hover:bg-secondary/40 hover:shadow-xs"
          >
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                <FileText className="size-5" />
              </div>
              <div>
                <div className="text-xl font-bold tracking-tight text-foreground">
                  {partner.financial.invoiceCount}
                </div>
                <div className="text-xs font-medium text-muted-foreground">
                  <T k="Customer Invoices" />
                </div>
              </div>
            </div>
            <ArrowUpRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary" />
          </Link>
        ) : null}
        {partner.isSupplier ? (
          <Link
            href={`/admin/purchasing?view=supplier-bills&partnerId=${partner.id}`}
            className="group flex items-center justify-between rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/50 hover:bg-secondary/40 hover:shadow-xs"
          >
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                <Receipt className="size-5" />
              </div>
              <div>
                <div className="text-xl font-bold tracking-tight text-foreground">
                  {partner.financial.billCount}
                </div>
                <div className="text-xs font-medium text-muted-foreground">
                  <T k="Vendor Bills" />
                </div>
              </div>
            </div>
            <ArrowUpRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary" />
          </Link>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border border-l-4 border-l-amber-500 bg-card p-4 shadow-xs">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <T k="Customer unpaid" />
          </div>
          <div className="mt-1 text-xl font-bold tracking-tight text-foreground">
            {money(partner.financial.receivableResidualMinor, partner.currencyCode)}
          </div>
        </div>
        <div className="rounded-xl border border-border border-l-4 border-l-emerald-600 bg-card p-4 shadow-xs">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <T k="Available credit" />
          </div>
          <div className="mt-1 text-xl font-bold tracking-tight text-foreground">
            {money(partner.financial.remainingCreditMinor, partner.currencyCode)}
          </div>
        </div>
        <div className="rounded-xl border border-border border-l-4 border-l-rose-500 bg-card p-4 shadow-xs">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <T k="Supplier unpaid" />
          </div>
          <div className="mt-1 text-xl font-bold tracking-tight text-foreground">
            {money(partner.financial.payableResidualMinor, partner.currencyCode)}
          </div>
        </div>
        <div
          className={`rounded-xl border border-border border-l-4 bg-card p-4 shadow-xs ${
            partner.financial.netBalanceMinor >= 0
              ? "border-l-emerald-600"
              : "border-l-rose-500"
          }`}
        >
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <T k="Net balance" />
          </div>
          <div
            className={`mt-1 text-xl font-bold tracking-tight ${
              partner.financial.netBalanceMinor >= 0
                ? "text-emerald-700 dark:text-emerald-400"
                : "text-rose-600 dark:text-rose-400"
            }`}
          >
            {money(partner.financial.netBalanceMinor, partner.currencyCode)}
          </div>
        </div>
      </div>
    </section>
  );
}

export function PartnerForm({ mode, partner, paymentTerms, error }: PartnerFormProps) {
  const action = mode === "create" ? createPartner : updatePartner;
  const title = mode === "create" ? "New Partner" : "Edit Partner";
  const submitLabel = mode === "create" ? "Create partner" : "Save changes";

  return (
    <PageShell maxWidth="max-w-5xl">
      <PageHeader
        eyebrow="Partners"
        title={<T k={title} />}
        actions={
          <ButtonLink href="/admin/partners" variant="outline">
            <T k="Back to partners" />
          </ButtonLink>
        }
      />

      {error ? <Alert kind="error">{error}</Alert> : null}

      {hasFinancialSummary(partner) ? <PartnerSmartSummary partner={partner} /> : null}

      <form action={action} className="grid gap-5 rounded-xl border border-border bg-card p-6 shadow-xs">
          {partner ? <input type="hidden" name="id" value={partner.id} /> : null}

          {partner ? <input type="hidden" name="code" value={partner.code} /> : null}

          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-1 text-sm font-medium">
              <T k="field.displayName" />
              <input
                name="displayName"
                defaultValue={partner?.displayName}
                required
                maxLength={200}
                className="h-10 rounded-md border border-input bg-background px-3 font-normal text-foreground"
              />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              <T k="field.legalName" />
              <input
                name="legalName"
                defaultValue={partner?.legalName ?? ""}
                maxLength={200}
                className="h-10 rounded-md border border-input bg-background px-3 font-normal text-foreground"
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <fieldset className="rounded-md border border-border bg-background/40 px-3 py-2">
              <legend className="px-1 text-sm font-medium"><T k="field.role" /></legend>
              <label className="mt-1 flex items-center gap-2 text-sm">
                <input name="isCustomer" type="checkbox" defaultChecked={partner?.isCustomer ?? true} />
                <T k="Customer" />
              </label>
              <label className="mt-2 flex items-center gap-2 text-sm">
                <input name="isSupplier" type="checkbox" defaultChecked={partner?.isSupplier ?? false} />
                <T k="Supplier" />
              </label>
            </fieldset>
            <label className="grid gap-1 text-sm font-medium">
              <T k="field.paymentTerm" />
              <select
                name="paymentTermId"
                defaultValue={partner?.paymentTermId ?? ""}
                className="h-10 rounded-md border border-input bg-background px-3 font-normal text-foreground"
              >
                <option value=""><T k="common.none" /></option>
                {paymentTerms.map((term) => (
                  <option key={term.id} value={term.id}>
                    {term.name} ({term.dueDays} <T k="common.days" />)
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-medium">
              <T k="field.status" />
              <select
                name="status"
                defaultValue={partner?.status ?? "active"}
                className="h-10 rounded-md border border-input bg-background px-3 font-normal text-foreground"
              >
                {partnerStatusOptions.map((status) => (
                  <option key={status} value={status}>
                    <T k={`status.${status}`} />
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="grid gap-1 text-sm font-medium">
            <T k="Credit limit" />
            <input
              name="creditLimit"
              type="number"
              min="0"
              step="0.01"
              defaultValue={partner ? minorToDisplay(partner.creditLimitMinor) : "0.00"}
              className="h-10 rounded-md border border-input bg-background px-3 font-normal text-foreground"
            />
          </label>

          <section className="grid gap-4 rounded-lg border border-border bg-muted/20 p-4">
            <h2 className="text-base font-semibold text-foreground"><T k="Primary Contact" /></h2>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-1 text-sm font-medium">
                <T k="field.name" />
                <input
                  name="contactName"
                  defaultValue={partner?.primaryContact?.fullName ?? ""}
                  maxLength={160}
                  className="h-10 rounded-md border border-input bg-background px-3 font-normal text-foreground"
                />
              </label>
              <label className="grid gap-1 text-sm font-medium">
                <T k="field.roleTitle" />
                <input
                  name="contactRole"
                  defaultValue={partner?.primaryContact?.roleTitle ?? ""}
                  maxLength={100}
                  className="h-10 rounded-md border border-input bg-background px-3 font-normal text-foreground"
                />
              </label>
              <label className="grid gap-1 text-sm font-medium">
                <T k="field.phone" />
                <input
                  name="contactPhone"
                  defaultValue={partner?.primaryContact?.phone ?? ""}
                  maxLength={40}
                  className="h-10 rounded-md border border-input bg-background px-3 font-normal text-foreground"
                />
              </label>
              <label className="grid gap-1 text-sm font-medium">
                <T k="field.email" />
                <input
                  name="contactEmail"
                  type="email"
                  defaultValue={partner?.primaryContact?.email ?? ""}
                  maxLength={160}
                  className="h-10 rounded-md border border-input bg-background px-3 font-normal text-foreground"
                />
              </label>
            </div>
          </section>

          <section className="grid gap-4 rounded-lg border border-border bg-muted/20 p-4">
            <h2 className="text-base font-semibold text-foreground"><T k="Primary Address" /></h2>
            <div className="grid gap-4 md:grid-cols-3">
              <label className="grid gap-1 text-sm font-medium">
                <T k="field.type" />
                <select
                  name="addressType"
                  defaultValue={partner?.primaryAddress?.addressType ?? "office"}
                  className="h-10 rounded-md border border-input bg-background px-3 font-normal text-foreground"
                >
                  {addressTypeOptions.map((type) => (
                    <option key={type} value={type}>
                      <T k={`status.${type}`} fallback={type} />
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm font-medium md:col-span-2">
                <T k="field.label" />
                <input
                  name="addressLabel"
                  defaultValue={partner?.primaryAddress?.label ?? ""}
                  maxLength={100}
                  className="h-10 rounded-md border border-input bg-background px-3 font-normal text-foreground"
                />
              </label>
            </div>
            <label className="grid gap-1 text-sm font-medium">
              <T k="field.addressLine1" />
              <input
                name="addressLine1"
                defaultValue={partner?.primaryAddress?.line1 ?? ""}
                maxLength={200}
                className="h-10 rounded-md border border-input bg-background px-3 font-normal text-foreground"
              />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              <T k="field.addressLine2" />
              <input
                name="addressLine2"
                defaultValue={partner?.primaryAddress?.line2 ?? ""}
                maxLength={200}
                className="h-10 rounded-md border border-input bg-background px-3 font-normal text-foreground"
              />
            </label>
            <div className="grid gap-4 md:grid-cols-3">
              <label className="grid gap-1 text-sm font-medium">
                <T k="field.city" />
                <input
                  name="city"
                  defaultValue={partner?.primaryAddress?.city ?? ""}
                  maxLength={120}
                  className="h-10 rounded-md border border-input bg-background px-3 font-normal text-foreground"
                />
              </label>
              <label className="grid gap-1 text-sm font-medium">
                <T k="field.region" />
                <input
                  name="region"
                  defaultValue={partner?.primaryAddress?.region ?? ""}
                  maxLength={120}
                  className="h-10 rounded-md border border-input bg-background px-3 font-normal text-foreground"
                />
              </label>
              <label className="grid gap-1 text-sm font-medium">
                <T k="field.country" />
                <input
                  name="country"
                  defaultValue={partner?.primaryAddress?.country ?? "Ethiopia"}
                  required
                  maxLength={120}
                  className="h-10 rounded-md border border-input bg-background px-3 font-normal text-foreground"
                />
              </label>
            </div>
          </section>

          <label className="grid gap-1 text-sm font-medium">
            <T k="field.notes" />
            <textarea
              name="notes"
              defaultValue={partner?.notes ?? ""}
              rows={4}
              className="rounded-md border border-input bg-background px-3 py-2 font-normal text-foreground"
            />
          </label>

          <div className="flex flex-wrap justify-end gap-3 border-t border-border pt-4">
            <ButtonLink href="/admin/partners" variant="outline">
              <T k="action.cancel" />
            </ButtonLink>
            <Button type="submit">
              <T k={submitLabel} />
            </Button>
          </div>
        </form>
    </PageShell>
  );
}
