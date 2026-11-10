import { notFound } from "next/navigation";
import {
  Building2,
  User,
  MapPin,
  Phone,
  Mail,
  Edit,
  ArrowLeft,
} from "lucide-react";

import { Badge, StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { T } from "@/components/ui/t";
import { requirePermission } from "@/server/auth/session";
import {
  formatPartnerRoles,
  getPartnerDetail,
  minorToDisplay,
} from "@/server/partners/partners";
import { PartnerFinancialOverview } from "@/app/admin/partners/partner-financial-overview";

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
        <T k={label} />
      </div>
      {children ? (
        <div className="text-sm font-medium text-foreground">{children}</div>
      ) : (
        <div className="text-sm font-medium text-foreground">{fieldValue(value)}</div>
      )}
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
            <T k="Code" fallback="Code" />: {partner.code || <T k="product.unassigned" fallback="Unassigned" />}
          </span>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/admin/partners" variant="outline" size="sm">
              <ArrowLeft className="size-4" data-icon="inline-start" />
              <T k="action.back" />
            </ButtonLink>
            <ButtonLink href={`/admin/partners/${partner.id}/edit`} size="sm">
              <Edit className="size-4" data-icon="inline-start" />
              <T k="action.edit" />
            </ButtonLink>
          </div>
        }
      />

      <PartnerFinancialOverview partner={partner} />

      {/* Main Details Grid */}
      <section className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="rounded-xl border border-border bg-card p-6 shadow-xs">
          <div className="flex items-center gap-2.5 border-b border-border pb-4">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Building2 className="size-4" />
            </div>
            <h2 className="text-base font-semibold text-foreground">
              <T k="Partner Profile" />
            </h2>
          </div>

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <Field label="Partner Code" value={partner.code} />
            <Field label="Commercial Role">
              <div className="flex flex-wrap gap-1.5">
                {partner.isCustomer ? (
                  <Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary text-xs">
                    <T k="Customer" />
                  </Badge>
                ) : null}
                {partner.isSupplier ? (
                  <Badge variant="outline" className="border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-400 text-xs">
                    <T k="Supplier" />
                  </Badge>
                ) : null}
                {!partner.isCustomer && !partner.isSupplier ? (
                  <span>{formatPartnerRoles(partner)}</span>
                ) : null}
              </div>
            </Field>
            <Field label="Legal Entity Name" value={partner.legalName} />
            <Field label="Tax Identification (TIN)" value={partner.tin} />
            <Field label="field.status">
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
                <T k="Primary Contact" />
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
                <T k="Primary Address" />
              </h2>
            </div>
            <div className="mt-5 grid gap-4">
              <Field label="Address Type">
                {address?.addressType ? <T k={`status.${address.addressType}`} fallback={address.addressType} /> : "-"}
              </Field>
              <Field label="field.label" value={address?.label} />
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
