import Link from "next/link";
import { redirect } from "next/navigation";

import { NewPartnerModal } from "@/app/admin/partners/new-partner-modal";
import { Alert } from "@/components/ui/alert";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { TableFilterSelect } from "@/components/ui/table-filter-select";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import {
  getPartnerFormOptions,
  getPartnerList,
  minorToDisplay,
} from "@/server/partners/partners";
import { requirePermission, getUserPermissionCodes } from "@/server/auth/session";
import { PERMISSIONS, userHasPermission } from "@/server/iam/permissions";
import { restorePartner, softDeletePartner } from "./actions";

export const dynamic = "force-dynamic";

type PartnersPageProps = {
  searchParams: Promise<{
    q?: string;
    show?: string;
    role?: string;
    view?: string;
    notice?: string;
    error?: string;
    status?: string;
    paymentTerm?: string;
  }>;
};

export default async function PartnersPage({ searchParams }: PartnersPageProps) {
  const user = await requirePermission(PERMISSIONS.PARTNERS.VIEW);
  const userPerms = await getUserPermissionCodes(user.id);
  const canManage = userHasPermission(userPerms, PERMISSIONS.PARTNERS.MANAGE);

  const params = await searchParams;

  if (params.view === "payment-terms") {
    redirect("/admin/partners/payment-terms");
  }

  const showDeleted = params.show === "deleted";
  const role = params.role === "customer" || params.role === "supplier" ? params.role : undefined;
  const query = params.q ?? "";
  const status = params.status ?? "";
  const paymentTermId = params.paymentTerm ?? "";

  const [partners, formOptions] = await Promise.all([
    getPartnerList({ query, showDeleted, role, status, paymentTermId }),
    getPartnerFormOptions(),
  ]);

  const statusOptions = [
    { value: "active", label: "Active" },
    { value: "blocked", label: "Blocked" },
    { value: "inactive", label: "Inactive" },
  ];

  const paymentTermOptions = (formOptions?.paymentTerms ?? []).map((pt) => ({
    value: pt.id,
    label: `${pt.code} (${pt.name})`,
  }));

  return (
    <PageShell>
      <PageHeader
        eyebrow="Commercial Directory"
        title="Partners & Accounts"
        description="Manage customer profiles, supplier accounts, credit allowances, and primary contacts."
        actions={
          canManage && formOptions ? (
            <NewPartnerModal paymentTerms={formOptions.paymentTerms} />
          ) : undefined
        }
      />

      {params.notice ? <Alert kind="success">{params.notice}</Alert> : null}
      {params.error ? <Alert kind="error">{params.error}</Alert> : null}

      <div className="grid gap-5">
        <section className="rounded-xl border border-border bg-card shadow-xs">
          <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1 sm:max-w-md">
              <TableSearchInput
                defaultValue={query}
                placeholder="Search code, name, legal name, TIN..."
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <TableFilterSelect
                paramName="status"
                label="Status"
                options={statusOptions}
                allLabel="All Statuses"
              />
              <TableFilterSelect
                paramName="paymentTerm"
                label="Payment Term"
                options={paymentTermOptions}
                allLabel="All Terms"
              />
            </div>
          </div>

          <div className="flex gap-2 border-b border-border px-4 py-2.5 text-sm">
            <Link
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                !role ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
              }`}
              href="/admin/partners"
            >
              All Partners
            </Link>
            <Link
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                role === "customer" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
              }`}
              href="/admin/partners?role=customer"
            >
              Customers
            </Link>
            <Link
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                role === "supplier" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
              }`}
              href="/admin/partners?role=supplier"
            >
              Suppliers
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="bg-secondary/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Partner</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3 text-right">Credit limit</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {partners.map((partner) => (
                  <tr key={partner.id} className="border-t border-border transition-colors hover:bg-secondary/30">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-foreground">{partner.code}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/partners/${partner.id}`}
                        className="font-semibold text-primary underline-offset-4 hover:underline"
                      >
                        {partner.displayName}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {[partner.legalName, partner.tin ? `TIN ${partner.tin}` : null]
                          .filter(Boolean)
                          .join(" / ") || "No legal detail"}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {partner.isCustomer ? (
                          <Badge variant="primary" className="text-[10px]">
                            Customer
                          </Badge>
                        ) : null}
                        {partner.isSupplier ? (
                          <Badge variant="accent" className="text-[10px]">
                            Supplier
                          </Badge>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={partner.status} size="sm" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{partner.primaryContactName ?? "No contact"}</div>
                      <div className="text-xs text-muted-foreground">
                        {[partner.primaryContactPhone, partner.primaryContactEmail]
                          .filter(Boolean)
                          .join(" / ")}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-foreground">
                      {partner.currencyCode} {minorToDisplay(partner.creditLimitMinor)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        {!showDeleted ? (
                          <>
                            <ButtonLink
                              href={`/admin/partners/${partner.id}/edit`}
                              variant="outline"
                              size="sm"
                            >
                              Edit
                            </ButtonLink>
                            <form action={softDeletePartner}>
                              <input type="hidden" name="id" value={partner.id} />
                              <Button variant="danger" size="sm">
                                Delete
                              </Button>
                            </form>
                          </>
                        ) : (
                          <form action={restorePartner}>
                            <input type="hidden" name="id" value={partner.id} />
                            <Button variant="outline" size="sm">
                              Restore
                            </Button>
                          </form>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {partners.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                      <p className="font-medium text-foreground">No partners found</p>
                      <p className="mt-1 text-xs text-muted-foreground">Try adjusting your search criteria.</p>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </PageShell>
  );
}
