import Link from "next/link";

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
    <section className="mb-5 grid gap-3 md:grid-cols-[auto_auto_1fr]">
      <div className="flex flex-wrap gap-2 md:col-span-3">
        {partner.isCustomer ? (
          <Link
            href={`/admin/sales?view=invoices&partnerId=${partner.id}`}
            className="rounded-md border border-[#c9d1d4] bg-white px-4 py-3 text-sm font-semibold text-[#2f4a49]"
          >
            <span className="block text-lg leading-none">{partner.financial.invoiceCount}</span>
            <span className="mt-1 block text-xs font-medium text-[#58706f]">Customer Invoices</span>
          </Link>
        ) : null}
        {partner.isSupplier ? (
          <Link
            href={`/admin/purchasing?view=supplier-bills&partnerId=${partner.id}`}
            className="rounded-md border border-[#c9d1d4] bg-white px-4 py-3 text-sm font-semibold text-[#2f4a49]"
          >
            <span className="block text-lg leading-none">{partner.financial.billCount}</span>
            <span className="mt-1 block text-xs font-medium text-[#58706f]">Vendor Bills</span>
          </Link>
        ) : null}
      </div>

      <div className="rounded-md border border-[#d7dcdf] bg-white p-4">
        <div className="text-xs font-medium uppercase tracking-wide text-[#58706f]">Receivable unpaid</div>
        <div className="mt-1 text-lg font-semibold">
          {money(partner.financial.receivableResidualMinor, partner.currencyCode)}
        </div>
      </div>
      <div className="rounded-md border border-[#d7dcdf] bg-white p-4">
        <div className="text-xs font-medium uppercase tracking-wide text-[#58706f]">Remaining credit</div>
        <div className="mt-1 text-lg font-semibold">
          {money(partner.financial.remainingCreditMinor, partner.currencyCode)}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-md border border-[#d7dcdf] bg-white p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-[#58706f]">Payable unpaid</div>
          <div className="mt-1 text-lg font-semibold">
            {money(partner.financial.payableResidualMinor, partner.currencyCode)}
          </div>
        </div>
        <div className="rounded-md border border-[#d7dcdf] bg-white p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-[#58706f]">Net balance</div>
          <div className="mt-1 text-lg font-semibold">
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
    <main className="min-h-screen bg-[#f5f7f8] text-[#172026]">
      <section className="mx-auto w-full max-w-5xl px-6 py-8">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-[#d7dcdf] pb-5">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-[#58706f]">
              Partners
            </p>
            <h1 className="mt-1 text-2xl font-semibold">{title}</h1>
          </div>
          <Link
            href="/admin/partners"
            className="rounded-md border border-[#c9d1d4] bg-white px-3 py-2 text-sm font-medium text-[#2f4a49]"
          >
            Back to partners
          </Link>
        </header>

        {error ? (
          <div className="mb-5 rounded-md border border-[#e0a6a6] bg-[#fff7f7] px-4 py-3 text-sm text-[#8a2626]">
            {error}
          </div>
        ) : null}

        {hasFinancialSummary(partner) ? <PartnerSmartSummary partner={partner} /> : null}

        <form action={action} className="grid gap-5 rounded-lg border border-[#d7dcdf] bg-white p-5">
          {partner ? <input type="hidden" name="id" value={partner.id} /> : null}

          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-1 text-sm font-medium">
              Code
              <input
                name="code"
                defaultValue={partner?.code}
                required
                maxLength={40}
                className="h-10 rounded-md border border-[#c9d1d4] px-3 font-normal"
              />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              TIN
              <input
                name="tin"
                defaultValue={partner?.tin ?? ""}
                maxLength={30}
                className="h-10 rounded-md border border-[#c9d1d4] px-3 font-normal"
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-1 text-sm font-medium">
              Display name
              <input
                name="displayName"
                defaultValue={partner?.displayName}
                required
                maxLength={200}
                className="h-10 rounded-md border border-[#c9d1d4] px-3 font-normal"
              />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Legal name
              <input
                name="legalName"
                defaultValue={partner?.legalName ?? ""}
                maxLength={200}
                className="h-10 rounded-md border border-[#c9d1d4] px-3 font-normal"
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <fieldset className="rounded-md border border-[#d7dcdf] px-3 py-2">
              <legend className="px-1 text-sm font-medium">Role</legend>
              <label className="mt-1 flex items-center gap-2 text-sm">
                <input name="isCustomer" type="checkbox" defaultChecked={partner?.isCustomer ?? true} />
                Customer
              </label>
              <label className="mt-2 flex items-center gap-2 text-sm">
                <input name="isSupplier" type="checkbox" defaultChecked={partner?.isSupplier ?? false} />
                Supplier
              </label>
            </fieldset>
            <label className="grid gap-1 text-sm font-medium">
              Payment term
              <select
                name="paymentTermId"
                defaultValue={partner?.paymentTermId ?? ""}
                className="h-10 rounded-md border border-[#c9d1d4] px-3 font-normal"
              >
                <option value="">None</option>
                {paymentTerms.map((term) => (
                  <option key={term.id} value={term.id}>
                    {term.name} ({term.dueDays} days)
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Status
              <select
                name="status"
                defaultValue={partner?.status ?? "active"}
                className="h-10 rounded-md border border-[#c9d1d4] px-3 font-normal"
              >
                {partnerStatusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="grid gap-1 text-sm font-medium">
            Credit limit
            <input
              name="creditLimit"
              type="number"
              min="0"
              step="0.01"
              defaultValue={partner ? minorToDisplay(partner.creditLimitMinor) : "0.00"}
              className="h-10 rounded-md border border-[#c9d1d4] px-3 font-normal"
            />
          </label>

          <section className="grid gap-4 rounded-md border border-[#e1e6e8] p-4">
            <h2 className="text-base font-semibold">Primary Contact</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-1 text-sm font-medium">
                Name
                <input
                  name="contactName"
                  defaultValue={partner?.primaryContact?.fullName ?? ""}
                  maxLength={160}
                  className="h-10 rounded-md border border-[#c9d1d4] px-3 font-normal"
                />
              </label>
              <label className="grid gap-1 text-sm font-medium">
                Role/title
                <input
                  name="contactRole"
                  defaultValue={partner?.primaryContact?.roleTitle ?? ""}
                  maxLength={100}
                  className="h-10 rounded-md border border-[#c9d1d4] px-3 font-normal"
                />
              </label>
              <label className="grid gap-1 text-sm font-medium">
                Phone
                <input
                  name="contactPhone"
                  defaultValue={partner?.primaryContact?.phone ?? ""}
                  maxLength={40}
                  className="h-10 rounded-md border border-[#c9d1d4] px-3 font-normal"
                />
              </label>
              <label className="grid gap-1 text-sm font-medium">
                Email
                <input
                  name="contactEmail"
                  type="email"
                  defaultValue={partner?.primaryContact?.email ?? ""}
                  maxLength={160}
                  className="h-10 rounded-md border border-[#c9d1d4] px-3 font-normal"
                />
              </label>
            </div>
          </section>

          <section className="grid gap-4 rounded-md border border-[#e1e6e8] p-4">
            <h2 className="text-base font-semibold">Primary Address</h2>
            <div className="grid gap-4 md:grid-cols-3">
              <label className="grid gap-1 text-sm font-medium">
                Type
                <select
                  name="addressType"
                  defaultValue={partner?.primaryAddress?.addressType ?? "office"}
                  className="h-10 rounded-md border border-[#c9d1d4] px-3 font-normal"
                >
                  {addressTypeOptions.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm font-medium md:col-span-2">
                Label
                <input
                  name="addressLabel"
                  defaultValue={partner?.primaryAddress?.label ?? ""}
                  maxLength={100}
                  className="h-10 rounded-md border border-[#c9d1d4] px-3 font-normal"
                />
              </label>
            </div>
            <label className="grid gap-1 text-sm font-medium">
              Address line 1
              <input
                name="addressLine1"
                defaultValue={partner?.primaryAddress?.line1 ?? ""}
                maxLength={200}
                className="h-10 rounded-md border border-[#c9d1d4] px-3 font-normal"
              />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Address line 2
              <input
                name="addressLine2"
                defaultValue={partner?.primaryAddress?.line2 ?? ""}
                maxLength={200}
                className="h-10 rounded-md border border-[#c9d1d4] px-3 font-normal"
              />
            </label>
            <div className="grid gap-4 md:grid-cols-3">
              <label className="grid gap-1 text-sm font-medium">
                City
                <input
                  name="city"
                  defaultValue={partner?.primaryAddress?.city ?? ""}
                  maxLength={120}
                  className="h-10 rounded-md border border-[#c9d1d4] px-3 font-normal"
                />
              </label>
              <label className="grid gap-1 text-sm font-medium">
                Region
                <input
                  name="region"
                  defaultValue={partner?.primaryAddress?.region ?? ""}
                  maxLength={120}
                  className="h-10 rounded-md border border-[#c9d1d4] px-3 font-normal"
                />
              </label>
              <label className="grid gap-1 text-sm font-medium">
                Country
                <input
                  name="country"
                  defaultValue={partner?.primaryAddress?.country ?? "Ethiopia"}
                  required
                  maxLength={120}
                  className="h-10 rounded-md border border-[#c9d1d4] px-3 font-normal"
                />
              </label>
            </div>
          </section>

          <label className="grid gap-1 text-sm font-medium">
            Notes
            <textarea
              name="notes"
              defaultValue={partner?.notes ?? ""}
              rows={4}
              className="rounded-md border border-[#c9d1d4] px-3 py-2 font-normal"
            />
          </label>

          <div className="flex flex-wrap justify-end gap-3 border-t border-[#e1e6e8] pt-4">
            <Link
              href="/admin/partners"
              className="rounded-md border border-[#c9d1d4] px-4 py-2 text-sm font-medium"
            >
              Cancel
            </Link>
            <button
              type="submit"
              className="rounded-md bg-[#1f6b5c] px-4 py-2 text-sm font-semibold text-white"
            >
              {submitLabel}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
