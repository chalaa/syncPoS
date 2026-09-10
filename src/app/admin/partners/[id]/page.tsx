import { notFound } from "next/navigation";
import Link from "next/link";
import {
  Building2,
  User,
  MapPin,
  CreditCard,
  ArrowUpRight,
  FileText,
  Receipt,
  Phone,
  Mail,
  Edit,
  ArrowLeft,
  Banknote,
  DollarSign,
  Briefcase,
} from "lucide-react";

import { Badge, StatusBadge } from "@/components/ui/badge";
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

function Field({
  label,
  value,
  children,
}: {
  label: string;
  value?: string | number | null;
  children?: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      {children ? (
        <div className="text-sm font-medium text-foreground">{children}</div>
      ) : (
        <div className="text-sm font-medium text-foreground">{fieldValue(value)}</div>
      )}
    </div>
  );
}

function PartnerSmartButtons({ partner }: { partner: PartnerDetailRecord }) {
  if (!partner.isCustomer && !partner.isSupplier) {
    return null;
  }

  return (
    <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
                Customer Invoices
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
                Vendor Bills
              </div>
            </div>
          </div>
          <ArrowUpRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary" />
        </Link>
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
        eyebrow="Commercial Partner"
        title={
          <div className="flex flex-wrap items-center gap-3">
            <span>{partner.displayName}</span>
            <StatusBadge status={partner.status} />
          </div>
        }
        description={
          <span className="font-mono text-xs text-muted-foreground">
            Code: {partner.code || "Unassigned"}
          </span>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/admin/partners" variant="outline" size="sm">
              <ArrowLeft className="size-4" data-icon="inline-start" />
              Back
            </ButtonLink>
            <ButtonLink href={`/admin/partners/${partner.id}/edit`} size="sm">
              <Edit className="size-4" data-icon="inline-start" />
              Edit
            </ButtonLink>
          </div>
        }
      />

      <PartnerSmartButtons partner={partner} />

      {/* Financial KPI Summary Cards */}
      <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border border-l-4 border-l-amber-500 bg-card p-4.5 shadow-xs transition-all hover:shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Customer Unpaid
            </span>
            <DollarSign className="size-4 text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-foreground">
            {money(partner.financial.receivableResidualMinor, partner.currencyCode)}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Outstanding receivables</p>
        </div>

        <div className="rounded-xl border border-border border-l-4 border-l-emerald-600 bg-card p-4.5 shadow-xs transition-all hover:shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Available Credit
            </span>
            <CreditCard className="size-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-foreground">
            {money(partner.financial.remainingCreditMinor, partner.currencyCode)}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Remaining credit line</p>
        </div>

        <div className="rounded-xl border border-border border-l-4 border-l-rose-500 bg-card p-4.5 shadow-xs transition-all hover:shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Supplier Unpaid
            </span>
            <Banknote className="size-4 text-rose-500" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-foreground">
            {money(partner.financial.payableResidualMinor, partner.currencyCode)}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Outstanding payables</p>
        </div>

        <div
          className={`rounded-xl border border-border border-l-4 bg-card p-4.5 shadow-xs transition-all hover:shadow-sm ${
            partner.financial.netBalanceMinor >= 0
              ? "border-l-emerald-600"
              : "border-l-rose-500"
          }`}
        >
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Net Balance
            </span>
            <Briefcase className="size-4 text-muted-foreground" />
          </div>
          <div
            className={`mt-2 text-2xl font-bold tracking-tight ${
              partner.financial.netBalanceMinor >= 0
                ? "text-emerald-700 dark:text-emerald-400"
                : "text-rose-600 dark:text-rose-400"
            }`}
          >
            {money(partner.financial.netBalanceMinor, partner.currencyCode)}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Receivable minus payable</p>
        </div>
      </section>

      {/* Main Details Grid */}
      <section className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="rounded-xl border border-border bg-card p-6 shadow-xs">
          <div className="flex items-center gap-2.5 border-b border-border pb-4">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Building2 className="size-4" />
            </div>
            <h2 className="text-base font-semibold text-foreground">
              Partner Profile
            </h2>
          </div>

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <Field label="Partner Code" value={partner.code} />
            <Field label="Commercial Role">
              <div className="flex flex-wrap gap-1.5">
                {partner.isCustomer ? (
                  <Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary text-xs">
                    Customer
                  </Badge>
                ) : null}
                {partner.isSupplier ? (
                  <Badge variant="outline" className="border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-400 text-xs">
                    Supplier
                  </Badge>
                ) : null}
                {!partner.isCustomer && !partner.isSupplier ? (
                  <span>{formatPartnerRoles(partner)}</span>
                ) : null}
              </div>
            </Field>
            <Field label="Legal Entity Name" value={partner.legalName} />
            <Field label="Tax Identification (TIN)" value={partner.tin} />
            <Field label="Status">
              <StatusBadge status={partner.status} />
            </Field>
            <Field label="Payment Terms" value={term} />
            <Field
              label="Credit Limit"
              value={money(partner.creditLimitMinor, partner.currencyCode)}
            />
            <Field label="Operating Currency" value={partner.currencyCode} />
          </div>

          {partner.notes ? (
            <div className="mt-6 border-t border-border pt-5">
              <Field label="Commercial Notes" value={partner.notes} />
            </div>
          ) : null}
        </div>

        <div className="grid gap-6">
          <div className="rounded-xl border border-border bg-card p-6 shadow-xs">
            <div className="flex items-center gap-2.5 border-b border-border pb-4">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <User className="size-4" />
              </div>
              <h2 className="text-base font-semibold text-foreground">
                Primary Contact
              </h2>
            </div>
            <div className="mt-5 grid gap-4">
              <Field label="Full Name" value={contact?.fullName} />
              <Field label="Designation / Role" value={contact?.roleTitle} />
              <Field label="Direct Phone">
                {contact?.phone ? (
                  <a
                    href={`tel:${contact.phone}`}
                    className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
                  >
                    <Phone className="size-3.5" />
                    {contact.phone}
                  </a>
                ) : (
                  "-"
                )}
              </Field>
              <Field label="Email Address">
                {contact?.email ? (
                  <a
                    href={`mailto:${contact.email}`}
                    className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
                  >
                    <Mail className="size-3.5" />
                    {contact.email}
                  </a>
                ) : (
                  "-"
                )}
              </Field>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-6 shadow-xs">
            <div className="flex items-center gap-2.5 border-b border-border pb-4">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <MapPin className="size-4" />
              </div>
              <h2 className="text-base font-semibold text-foreground">
                Primary Address
              </h2>
            </div>
            <div className="mt-5 grid gap-4">
              <Field label="Address Type" value={address?.addressType} />
              <Field label="Label" value={address?.label} />
              <Field label="Street Line 1" value={address?.line1} />
              {address?.line2 ? (
                <Field label="Street Line 2" value={address?.line2} />
              ) : null}
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
