"use client";

import Link from "next/link";
import { Mail, Phone, User, Users } from "lucide-react";

import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { ClickableTableRow } from "@/components/ui/clickable-table-row";
import { DeleteConfirmationDialog } from "@/components/ui/delete-confirmation-dialog";
import { useViewMode } from "@/components/ui/view-mode-toggle";
import { T } from "@/components/ui/t";
import { minorToDisplay } from "@/server/partners/partners";
import { restorePartner, softDeletePartner } from "./actions";

export type PartnerRow = {
  id: string;
  code: string;
  displayName: string;
  legalName: string | null;
  tin: string | null;
  isCustomer: boolean;
  isSupplier: boolean;
  status: string;
  primaryContactName: string | null;
  primaryContactPhone: string | null;
  primaryContactEmail: string | null;
  currencyCode: string;
  creditLimitMinor: number;
};

export function PartnerListTable({
  partners,
  showDeleted,
}: {
  partners: PartnerRow[];
  showDeleted: boolean;
}) {
  const [viewMode] = useViewMode("partners", "table");

  const renderEmptyState = () => (
    <div className="px-4 py-12 text-center text-muted-foreground">
      <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground ring-1 ring-border mb-3">
        <Users className="size-6" />
      </div>
      <p className="font-medium text-foreground"><T k="No partners found" /></p>
      <p className="mt-1 text-xs text-muted-foreground"><T k="Try adjusting your search criteria." /></p>
    </div>
  );

  const renderActions = (partner: PartnerRow) => (
    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
      {!showDeleted ? (
        <>
          <ButtonLink
            href={`/admin/partners/${partner.id}/edit`}
            variant="outline"
            size="sm"
            className="h-8 px-2.5 text-xs"
          >
            <T k="action.edit" />
          </ButtonLink>
          <DeleteConfirmationDialog
            action={softDeletePartner}
            hiddenInputs={{ id: partner.id }}
            itemName={partner.displayName}
          />
        </>
      ) : (
        <form action={restorePartner}>
          <input type="hidden" name="id" value={partner.id} />
          <Button variant="outline" size="sm" className="h-8 px-2.5 text-xs">
            <T k="action.restore" />
          </Button>
        </form>
      )}
    </div>
  );

  return (
    <>
      {viewMode === "grid" ? (
        <div className="p-4 sm:p-5">
          {partners.length === 0 ? (
            renderEmptyState()
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {partners.map((partner) => (
                <div
                  key={partner.id}
                  className="flex flex-col justify-between rounded-xl border border-border bg-card p-4 transition-all duration-150 hover:border-primary/40 hover:shadow-md"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="inline-flex items-center font-mono text-xs font-semibold px-2 py-0.5 rounded-md border border-primary/20 bg-primary/5 text-primary">
                          {partner.code}
                        </span>
                        <h4 className="font-semibold text-foreground mt-1 line-clamp-1">
                          <Link
                            href={`/admin/partners/${partner.id}`}
                            className="hover:text-primary transition-colors hover:underline"
                          >
                            {partner.displayName}
                          </Link>
                        </h4>
                        <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                          {[partner.legalName, partner.tin ? `TIN ${partner.tin}` : null]
                            .filter(Boolean)
                            .join(" / ") || <T k="No legal detail" />}
                        </p>
                      </div>
                      <StatusBadge status={partner.status} size="sm" />
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {partner.isCustomer ? (
                        <Badge variant="primary" className="text-[10px]">
                          <T k="Customer" />
                        </Badge>
                      ) : null}
                      {partner.isSupplier ? (
                        <Badge variant="accent" className="text-[10px]">
                          <T k="Supplier" />
                        </Badge>
                      ) : null}
                    </div>

                    <div className="rounded-xl border border-border/70 bg-muted/20 p-2.5 text-xs space-y-1">
                      <div className="flex items-center gap-1.5 font-medium text-foreground truncate">
                        <User className="size-3.5 text-muted-foreground shrink-0" />
                        <span>{partner.primaryContactName ?? <T k="No contact" />}</span>
                      </div>
                      {partner.primaryContactPhone ? (
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Phone className="size-3 text-muted-foreground shrink-0" />
                          <span>{partner.primaryContactPhone}</span>
                        </div>
                      ) : null}
                      {partner.primaryContactEmail ? (
                        <div className="flex items-center gap-1.5 text-muted-foreground truncate">
                          <Mail className="size-3 text-muted-foreground shrink-0" />
                          <span>{partner.primaryContactEmail}</span>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-3 mt-3 border-t border-border/60">
                    <div>
                      <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
                        <T k="Credit limit" />
                      </span>
                      <span className="font-mono text-xs font-bold text-foreground">
                        {partner.currencyCode} {minorToDisplay(partner.creditLimitMinor)}
                      </span>
                    </div>
                    {renderActions(partner)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : viewMode === "list" ? (
        <div>
          {partners.length === 0 ? (
            renderEmptyState()
          ) : (
            <div className="divide-y divide-border/60">
              {partners.map((partner) => (
                <div
                  key={partner.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 transition-colors hover:bg-muted/30"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 flex-1 min-w-0">
                    <div className="shrink-0">
                      <Link
                        href={`/admin/partners/${partner.id}`}
                        className="font-mono text-xs font-bold text-primary hover:underline inline-flex items-center rounded-md bg-primary/5 border border-primary/20 px-2 py-1"
                      >
                        {partner.code}
                      </Link>
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/admin/partners/${partner.id}`}
                          className="font-semibold text-foreground hover:text-primary transition-colors truncate"
                        >
                          {partner.displayName}
                        </Link>
                        <StatusBadge status={partner.status} size="sm" />
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {partner.isCustomer ? (
                          <Badge variant="primary" className="text-[10px]">
                            <T k="Customer" />
                          </Badge>
                        ) : null}
                        {partner.isSupplier ? (
                          <Badge variant="accent" className="text-[10px]">
                            <T k="Supplier" />
                          </Badge>
                        ) : null}
                        <span>
                          {partner.primaryContactName ? `Contact: ${partner.primaryContactName}` : null}
                          {partner.primaryContactPhone ? ` (${partner.primaryContactPhone})` : null}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-5 shrink-0">
                    <div className="text-right">
                      <div className="text-[10px] uppercase font-semibold text-muted-foreground">
                        <T k="Credit limit" />
                      </div>
                      <div className="font-mono text-xs font-bold text-foreground">
                        {partner.currencyCode} {minorToDisplay(partner.creditLimitMinor)}
                      </div>
                    </div>
                    {renderActions(partner)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead className="bg-secondary/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-4 py-3"><T k="field.code" /></th>
                <th className="px-4 py-3"><T k="Partner" /></th>
                <th className="px-4 py-3"><T k="field.role" /></th>
                <th className="px-4 py-3"><T k="field.status" /></th>
                <th className="px-4 py-3"><T k="Contact" /></th>
                <th className="px-4 py-3 text-right"><T k="Credit limit" /></th>
                <th className="px-4 py-3 text-right"><T k="action.actions" /></th>
              </tr>
            </thead>
            <tbody>
              {partners.map((partner) => (
                <ClickableTableRow key={partner.id} href={`/admin/partners/${partner.id}`}>
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
                        .join(" / ") || <T k="No legal detail" />}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {partner.isCustomer ? (
                        <Badge variant="primary" className="text-[10px]">
                          <T k="Customer" />
                        </Badge>
                      ) : null}
                      {partner.isSupplier ? (
                        <Badge variant="accent" className="text-[10px]">
                          <T k="Supplier" />
                        </Badge>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={partner.status} size="sm" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{partner.primaryContactName ?? <T k="No contact" />}</div>
                    <div className="text-xs text-muted-foreground">
                      {[partner.primaryContactPhone, partner.primaryContactEmail]
                        .filter(Boolean)
                        .join(" / ")}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-foreground">
                    {partner.currencyCode} {minorToDisplay(partner.creditLimitMinor)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {renderActions(partner)}
                  </td>
                </ClickableTableRow>
              ))}
              {partners.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    {renderEmptyState()}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
