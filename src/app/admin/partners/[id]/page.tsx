import { notFound } from "next/navigation";

import { ButtonLink } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { requirePermission } from "@/server/auth/session";
import {
  formatPartnerRoles,
  getPartnerDetail,
  minorToDisplay,
} from "@/server/partners/partners";
import type { PartnerDetailRecord } from "@/server/partners/types";

export const dynamic = "force-dynamic";

type PartnerDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

function money(value: number, currencyCode: string) {
  return `${currencyCode} ${minorToDisplay(value)}`;
}

function fieldValue(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  return String(value);
}

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div>
      <div className="text-xs font-medium uppercase text-muted-foreground">{label}</div>
      <div className="mt-1 font-medium">{fieldValue(value)}</div>
    </div>
  );
}

function SmartButton({
  href,
  label,
  value,
}: {
  href: string;
  label: string;
  value: string | number;
}) {
  return (
    <ButtonLink href={href} variant="secondary" className="h-auto min-w-[150px] flex-col gap-1 py-3">
      <span className="text-lg font-semibold leading-none">{value}</span>
      <span className="text-xs font-medium text-secondary-foreground/80">{label}</span>
    </ButtonLink>
  );
}

function PartnerSmartButtons({ partner }: { partner: PartnerDetailRecord }) {
  return (
    <div className="mb-5 flex flex-wrap gap-2">
      {partner.isCustomer ? (
        <SmartButton
          href={`/admin/sales?view=invoices&partnerId=${partner.id}`}
          label="Customer Invoices"
          value={partner.financial.invoiceCount}
        />
      ) : null}
      {partner.isSupplier ? (
        <SmartButton
          href={`/admin/purchasing?view=supplier-bills&partnerId=${partner.id}`}
          label="Vendor Bills"
          value={partner.financial.billCount}
        />
      ) : null}
    </div>
  );
}

export default async function PartnerDetailPage({ params }: PartnerDetailPageProps) {
  await requirePermission("partner.view");

  const { id } = await params;
  const partner = await getPartnerDetail(id);

  if (!partner) {
    notFound();
  }

  const contact = partner.primaryContact;
  const address = partner.primaryAddress;
  const term = partner.paymentTermName
    ? `${partner.paymentTermName} (${partner.paymentTermDueDays ?? 0} days)`
    : null;

  return (
    <PageShell>
      <PageHeader
        eyebrow="Partner"
        title={partner.displayName}
        actions={
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/admin/partners" variant="outline">
              Back
            </ButtonLink>
            <ButtonLink href={`/admin/partners/${partner.id}/edit`}>
              Edit
            </ButtonLink>
          </div>
        }
      />

      <PartnerSmartButtons partner={partner} />

      <section className="mb-5 grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-xs font-medium uppercase text-muted-foreground">Customer unpaid</div>
          <div className="mt-2 text-xl font-semibold">
            {money(partner.financial.receivableResidualMinor, partner.currencyCode)}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-xs font-medium uppercase text-muted-foreground">Available customer credit</div>
          <div className="mt-2 text-xl font-semibold">
            {money(partner.financial.remainingCreditMinor, partner.currencyCode)}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-xs font-medium uppercase text-muted-foreground">Supplier unpaid</div>
          <div className="mt-2 text-xl font-semibold">
            {money(partner.financial.payableResidualMinor, partner.currencyCode)}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-xs font-medium uppercase text-muted-foreground">Net balance receivable-payable</div>
          <div className="mt-2 text-xl font-semibold">
            {money(partner.financial.netBalanceMinor, partner.currencyCode)}
          </div>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <div className="rounded-lg border border-border bg-card p-5">
          <h2 className="text-lg font-semibold">Partner Information</h2>
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <Field label="Code" value={partner.code} />
            <Field label="Role" value={formatPartnerRoles(partner)} />
            <Field label="Legal name" value={partner.legalName} />
            <Field label="TIN" value={partner.tin} />
            <Field label="Status" value={partner.status} />
            <Field label="Payment term" value={term} />
            <Field label="Credit limit" value={money(partner.creditLimitMinor, partner.currencyCode)} />
            <Field label="Currency" value={partner.currencyCode} />
          </div>
          {partner.notes ? (
            <div className="mt-5 border-t border-border pt-5">
              <Field label="Notes" value={partner.notes} />
            </div>
          ) : null}
        </div>

        <div className="grid gap-5">
          <div className="rounded-lg border border-border bg-card p-5">
            <h2 className="text-lg font-semibold">Primary Contact</h2>
            <div className="mt-5 grid gap-4">
              <Field label="Name" value={contact?.fullName} />
              <Field label="Role" value={contact?.roleTitle} />
              <Field label="Phone" value={contact?.phone} />
              <Field label="Email" value={contact?.email} />
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-5">
            <h2 className="text-lg font-semibold">Primary Address</h2>
            <div className="mt-5 grid gap-4">
              <Field label="Type" value={address?.addressType} />
              <Field label="Label" value={address?.label} />
              <Field label="Line 1" value={address?.line1} />
              <Field label="Line 2" value={address?.line2} />
              <Field
                label="City / Region"
                value={[address?.city, address?.region].filter(Boolean).join(" / ")}
              />
              <Field label="Country" value={address?.country} />
            </div>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
