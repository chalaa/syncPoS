"use client";

import Link from "next/link";
import { ArrowLeftRight, Calendar, Eye, MapPin, Truck } from "lucide-react";

import { StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { ClickableTableRow } from "@/components/ui/clickable-table-row";
import { TableFilterBar } from "@/components/ui/table-filter-bar";
import { TableFilterSelect } from "@/components/ui/table-filter-select";
import { useViewMode } from "@/components/ui/view-mode-toggle";
import { T } from "@/components/ui/t";
import type { TransferListRow } from "@/server/transfers/types";

export function TransferList({ transfers }: { transfers: TransferListRow[] }) {
  const [viewMode, setViewMode] = useViewMode("inventory_transfers", "table");

  const statusOptions = [
    { value: "draft", label: "Draft" },
    { value: "dispatched", label: "Dispatched" },
    { value: "in_transit", label: "In Transit" },
    { value: "received", label: "Received" },
    { value: "cancelled", label: "Cancelled" },
  ];

  const renderEmptyState = () => (
    <div className="mx-auto flex max-w-sm flex-col items-center justify-center py-16 text-center">
      <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground mb-3">
        <ArrowLeftRight className="size-6" />
      </div>
      <p className="font-bold text-sm text-foreground">
        <T k="inventory.noTransfersFound" fallback="No transit transfers found" />
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        <T k="inventory.noTransfersHint" fallback="Multi-stage transfers between locations will appear here once initiated." />
      </p>
    </div>
  );

  return (
    <section className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-xs">
      <TableFilterBar
        searchPlaceholder="Search transfer number, origin, or destination..."
        filterParamNames={["status"]}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      >
        <TableFilterSelect
          paramName="status"
          label="Status"
          options={statusOptions}
          allLabel="All Statuses"
        />
      </TableFilterBar>

      {viewMode === "grid" ? (
        <div className="p-4 sm:p-5">
          {transfers.length === 0 ? (
            renderEmptyState()
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {transfers.map((transfer) => (
                <div
                  key={transfer.id}
                  className="flex flex-col justify-between rounded-xl border border-border bg-card p-4 transition-all duration-150 hover:border-primary/40 hover:shadow-md"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <Link
                          href={`/admin/inventory/transfers/${transfer.id}`}
                          className="font-mono text-sm font-bold text-primary hover:underline"
                        >
                          {transfer.transferNo}
                        </Link>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                          <Calendar className="size-3 text-muted-foreground/70" />
                          <span>{transfer.transferDate}</span>
                        </div>
                      </div>
                      <StatusBadge status={transfer.status} />
                    </div>

                    <div className="rounded-xl border border-border/70 bg-muted/20 p-2.5 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">From:</span>
                        <span className="font-semibold text-foreground">{transfer.fromLocationCode}</span>
                      </div>
                      {transfer.transitLocationCode ? (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Transit:</span>
                          <span className="font-medium text-muted-foreground">{transfer.transitLocationCode}</span>
                        </div>
                      ) : null}
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">To:</span>
                        <span className="font-semibold text-foreground">{transfer.toLocationCode}</span>
                      </div>
                      {transfer.ownerName ? (
                        <div className="text-muted-foreground pt-1 border-t border-border/50">
                          Owner: {transfer.ownerName}
                        </div>
                      ) : null}
                    </div>

                    <div className="grid grid-cols-3 gap-1 p-2 rounded-lg bg-muted/30 border border-border/60 text-center text-xs">
                      <div>
                        <span className="text-[10px] uppercase font-semibold text-muted-foreground block">Req</span>
                        <span className="font-mono font-bold text-foreground">{transfer.quantityRequested}</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-semibold text-muted-foreground block">Disp</span>
                        <span className="font-mono text-muted-foreground">{transfer.quantityDispatched}</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-semibold text-muted-foreground block">Recv</span>
                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{transfer.quantityReceived}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-3 mt-3 border-t border-border/60">
                    <span className="text-xs text-muted-foreground">{transfer.lineCount} lines</span>
                    <ButtonLink
                      href={`/admin/inventory/transfers/${transfer.id}`}
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1 px-3 text-xs font-semibold"
                    >
                      <Eye className="size-3" />
                      <T k="action.details" fallback="Details" />
                    </ButtonLink>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : viewMode === "list" ? (
        <div>
          {transfers.length === 0 ? (
            renderEmptyState()
          ) : (
            <div className="divide-y divide-border/60">
              {transfers.map((transfer) => (
                <div
                  key={transfer.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 transition-colors hover:bg-muted/30"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 flex-1 min-w-0">
                    <div className="shrink-0">
                      <Link
                        href={`/admin/inventory/transfers/${transfer.id}`}
                        className="font-mono text-sm font-bold text-primary hover:underline"
                      >
                        {transfer.transferNo}
                      </Link>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                        <Calendar className="size-3 text-muted-foreground/70" />
                        <span>{transfer.transferDate}</span>
                      </div>
                    </div>

                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <StatusBadge status={transfer.status} />
                        <span className="text-xs font-medium text-foreground">
                          {transfer.fromLocationCode} → {transfer.toLocationCode}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>{transfer.lineCount} lines</span>
                        {transfer.ownerName ? <span>· Owner: {transfer.ownerName}</span> : null}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-5 shrink-0">
                    <div className="text-right">
                      <div className="text-xs font-mono">
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">{transfer.quantityReceived}</span>
                        <span className="text-muted-foreground"> / {transfer.quantityRequested} received</span>
                      </div>
                    </div>

                    <ButtonLink
                      href={`/admin/inventory/transfers/${transfer.id}`}
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1 px-3 text-xs font-semibold"
                    >
                      <Eye className="size-3" />
                      <T k="action.details" fallback="Details" />
                    </ButtonLink>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] text-left text-sm">
            <thead>
              <tr className="border-b border-border/80 bg-muted/40 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3.5"><T k="table.transferNo" fallback="Transfer No" /></th>
                <th className="px-4 py-3.5"><T k="table.status" fallback="Status" /></th>
                <th className="px-4 py-3.5"><T k="table.owner" fallback="Owner" /></th>
                <th className="px-4 py-3.5"><T k="table.date" fallback="Date" /></th>
                <th className="px-4 py-3.5"><T k="field.from" fallback="From" /></th>
                <th className="px-4 py-3.5"><T k="field.transit" fallback="Transit" /></th>
                <th className="px-4 py-3.5"><T k="field.to" fallback="To" /></th>
                <th className="px-4 py-3.5 text-right"><T k="table.lines" fallback="Lines" /></th>
                <th className="px-4 py-3.5 text-right"><T k="table.requested" fallback="Requested" /></th>
                <th className="px-4 py-3.5 text-right"><T k="table.dispatched" fallback="Dispatched" /></th>
                <th className="px-4 py-3.5 text-right"><T k="table.received" fallback="Received" /></th>
                <th className="px-4 py-3.5 text-right"><T k="action.actions" fallback="Actions" /></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {transfers.map((transfer) => (
                <ClickableTableRow
                  key={transfer.id}
                  href={`/admin/inventory/transfers/${transfer.id}`}
                >
                  <td className="px-4 py-3.5 font-mono text-xs font-bold text-primary">
                    <Link
                      href={`/admin/inventory/transfers/${transfer.id}`}
                      className="group-hover:underline"
                    >
                      {transfer.transferNo}
                    </Link>
                  </td>
                  <td className="px-4 py-3.5">
                    <StatusBadge status={transfer.status} />
                  </td>
                  <td className="px-4 py-3.5 text-xs text-muted-foreground">
                    {transfer.toOwnerName && transfer.toOwnerName !== transfer.ownerName ? (
                      <div className="flex items-center gap-1">
                        <span>{transfer.ownerName ?? "—"}</span>
                        <span className="text-muted-foreground/60">→</span>
                        <span className="font-medium text-foreground">{transfer.toOwnerName}</span>
                      </div>
                    ) : (
                      <span>{transfer.ownerName ?? "—"}</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-xs text-muted-foreground font-medium">{transfer.transferDate}</td>
                  <td className="px-4 py-3.5 font-medium text-xs text-foreground">{transfer.fromLocationCode}</td>
                  <td className="px-4 py-3.5 font-medium text-xs text-muted-foreground">{transfer.transitLocationCode}</td>
                  <td className="px-4 py-3.5 font-medium text-xs text-foreground">{transfer.toLocationCode}</td>
                  <td className="px-4 py-3.5 text-right font-mono text-xs text-muted-foreground">{transfer.lineCount}</td>
                  <td className="px-4 py-3.5 text-right font-mono text-xs font-semibold text-foreground">
                    {transfer.quantityRequested}
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono text-xs text-muted-foreground">
                    {transfer.quantityDispatched}
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    {transfer.quantityReceived}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <ButtonLink
                      href={`/admin/inventory/transfers/${transfer.id}`}
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1 px-2.5 text-xs font-semibold"
                    >
                      <Eye className="size-3" />
                      <T k="action.details" fallback="Details" />
                    </ButtonLink>
                  </td>
                </ClickableTableRow>
              ))}
              {transfers.length === 0 && (
                <tr>
                  <td colSpan={12} className="px-4 py-16 text-center">
                    {renderEmptyState()}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
