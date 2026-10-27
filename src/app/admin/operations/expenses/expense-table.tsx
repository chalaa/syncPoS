"use client";

import Link from "next/link";
import { BanknoteIcon, Calendar, ChevronRight, Receipt, User, Tag } from "lucide-react";

import { cancelExpense } from "@/app/admin/operations/expenses/actions";
import { StatusBadge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { ClickableTableRow } from "@/components/ui/clickable-table-row";
import { SortableTableHead } from "@/components/ui/sortable-table-head";
import { useViewMode } from "@/components/ui/view-mode-toggle";
import { T } from "@/components/ui/t";
import { displayExpenseMoney } from "@/lib/catalog-utils";
import type { ExpenseListRow } from "@/server/expenses/types";

export function ExpenseTable({
  rows,
  showCancelled,
}: {
  rows: ExpenseListRow[];
  showCancelled: boolean;
}) {
  const [viewMode] = useViewMode("expenses", "table");

  const renderEmptyState = () => (
    <div className="px-4 py-12 text-center text-muted-foreground">
      <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground ring-1 ring-border mb-3">
        <Receipt className="size-6" />
      </div>
      <p className="font-medium text-foreground"><T k="No expenses found" /></p>
      <p className="mt-1 text-xs text-muted-foreground"><T k="Try adjusting your search keywords." /></p>
    </div>
  );

  const renderActions = (expense: ExpenseListRow) => (
    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
      <ButtonLink href={`/admin/operations/expenses/${expense.id}`} size="sm" variant="outline" className="h-8 gap-1 px-3 text-xs">
        <BanknoteIcon className="size-3.5" />
        <span><T k="action.details" fallback="Details" /></span>
      </ButtonLink>
      {!showCancelled && expense.status !== "cancelled" && expense.paymentStatus !== "paid" ? (
        <form action={cancelExpense}>
          <input type="hidden" name="id" value={expense.id} />
          <input type="hidden" name="returnPath" value="/admin/operations/expenses" />
          <Button variant="danger" size="sm" className="h-8 px-2.5 text-xs">
            <T k="action.cancelExpense" fallback="Cancel" />
          </Button>
        </form>
      ) : null}
    </div>
  );

  return (
    <>
      {viewMode === "grid" ? (
        <div className="p-4 sm:p-5">
          {rows.length === 0 ? (
            renderEmptyState()
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {rows.map((expense) => (
                <div
                  key={expense.id}
                  className="flex flex-col justify-between rounded-xl border border-border bg-card p-4 transition-all duration-150 hover:border-primary/40 hover:shadow-md"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <Link
                          href={`/admin/operations/expenses/${expense.id}`}
                          className="font-mono text-sm font-bold text-primary hover:underline"
                        >
                          {expense.expenseNo}
                        </Link>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                          <Calendar className="size-3 text-muted-foreground/70" />
                          <span>{expense.expenseDate}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <StatusBadge status={expense.paymentStatus} size="sm" />
                        {expense.status === "cancelled" ? (
                          <StatusBadge status="cancelled" size="sm" />
                        ) : null}
                      </div>
                    </div>

                    <div className="rounded-xl border border-border/70 bg-muted/20 p-2.5 text-xs space-y-1.5">
                      <div className="flex items-center gap-1.5 font-medium text-foreground">
                        <Tag className="size-3.5 text-muted-foreground shrink-0" />
                        <span>{expense.categoryName}</span>
                      </div>
                      {(expense.employeeName || expense.vendorName) ? (
                        <div className="flex items-center gap-1.5 text-muted-foreground truncate">
                          <User className="size-3.5 text-muted-foreground shrink-0" />
                          <span>{[expense.employeeName, expense.vendorName].filter(Boolean).join(" · ")}</span>
                        </div>
                      ) : null}
                      {expense.locationName ? (
                        <div className="text-muted-foreground">
                          Location: {expense.locationName}
                        </div>
                      ) : null}
                      {expense.description ? (
                        <div className="text-muted-foreground line-clamp-1 italic">
                          "{expense.description}"
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-3 mt-3 border-t border-border/60">
                    <div>
                      <div className="text-[10px] uppercase font-semibold text-muted-foreground">
                        <T k="field.amount" fallback="Amount" />
                      </div>
                      <div className="font-mono text-sm font-bold text-foreground">
                        {displayExpenseMoney(expense.amountMinor, expense.currencyCode)}
                      </div>
                      {expense.residualAmountMinor > 0 ? (
                        <div className="font-mono text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                          Due: {displayExpenseMoney(expense.residualAmountMinor, expense.currencyCode)}
                        </div>
                      ) : null}
                    </div>
                    {renderActions(expense)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : viewMode === "list" ? (
        <div>
          {rows.length === 0 ? (
            renderEmptyState()
          ) : (
            <div className="divide-y divide-border/60">
              {rows.map((expense) => (
                <div
                  key={expense.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 transition-colors hover:bg-muted/30"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 flex-1 min-w-0">
                    <div className="shrink-0">
                      <Link
                        href={`/admin/operations/expenses/${expense.id}`}
                        className="font-mono text-sm font-bold text-primary hover:underline"
                      >
                        {expense.expenseNo}
                      </Link>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                        <Calendar className="size-3 text-muted-foreground/70" />
                        <span>{expense.expenseDate}</span>
                      </div>
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="font-medium text-foreground truncate">{expense.categoryName}</div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {expense.employeeName ? <span>{expense.employeeName}</span> : null}
                        {expense.vendorName ? <span>· {expense.vendorName}</span> : null}
                        {expense.locationName ? <span>· {expense.locationName}</span> : null}
                        <StatusBadge status={expense.paymentStatus} size="sm" />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-5 shrink-0">
                    <div className="text-right">
                      <div className="text-[10px] uppercase font-semibold text-muted-foreground">
                        <T k="field.amount" fallback="Amount" />
                      </div>
                      <div className="font-mono text-sm font-bold text-foreground">
                        {displayExpenseMoney(expense.amountMinor, expense.currencyCode)}
                      </div>
                      {expense.residualAmountMinor > 0 ? (
                        <div className="font-mono text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                          Due: {displayExpenseMoney(expense.residualAmountMinor, expense.currencyCode)}
                        </div>
                      ) : null}
                    </div>
                    {renderActions(expense)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] text-left text-sm">
            <thead className="bg-secondary/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <tr className="border-b border-border">
                <SortableTableHead sortKey="expenseNo" label={<T k="Expense" />} className="px-4 py-3" />
                <SortableTableHead sortKey="expenseDate" label={<T k="field.date" fallback="Date" />} className="px-4 py-3" />
                <SortableTableHead sortKey="categoryName" label={<T k="field.category" />} className="px-4 py-3" />
                <th className="px-4 py-3"><T k="Employee / Vendor" /></th>
                <th className="px-4 py-3"><T k="field.location" fallback="Location" /></th>
                <th className="px-4 py-3"><T k="Payment" /></th>
                <SortableTableHead sortKey="amountMinor" label={<T k="field.amount" fallback="Amount" />} align="right" className="px-4 py-3" />
                <SortableTableHead sortKey="residualAmountMinor" label={<T k="Residual" />} align="right" className="px-4 py-3" />
                <th className="px-4 py-3 text-right"><T k="action.actions" /></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((expense) => (
                <ClickableTableRow key={expense.id} href={`/admin/operations/expenses/${expense.id}`}>
                  <td className="px-4 py-3">
                    <Link href={`/admin/operations/expenses/${expense.id}`} className="font-semibold text-primary underline-offset-4 hover:underline">
                      {expense.expenseNo}
                    </Link>
                    {expense.description ? <div className="text-xs text-muted-foreground">{expense.description}</div> : null}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{expense.expenseDate}</td>
                  <td className="px-4 py-3 font-medium text-foreground">{expense.categoryName}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{expense.employeeName ?? "-"}</div>
                    {expense.vendorName ? <div className="text-xs text-muted-foreground">{expense.vendorName}</div> : null}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{expense.locationName ?? "-"}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1 items-start">
                      <StatusBadge status={expense.paymentStatus} size="sm" />
                      {expense.status === "cancelled" ? (
                        <StatusBadge status="cancelled" size="sm" />
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-foreground">{displayExpenseMoney(expense.amountMinor, expense.currencyCode)}</td>
                  <td className="px-4 py-3 text-right font-medium text-amber-600 dark:text-amber-400">{displayExpenseMoney(expense.residualAmountMinor, expense.currencyCode)}</td>
                  <td className="px-4 py-3 text-right">
                    {renderActions(expense)}
                  </td>
                </ClickableTableRow>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
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
