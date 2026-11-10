import Link from "next/link";
import { ArrowUpRight, FileText, Receipt } from "lucide-react";

import { T } from "@/components/ui/t";
import { minorToDisplay } from "@/lib/catalog-utils";
import { cn } from "@/lib/utils";
import type { PartnerDetailRecord } from "@/server/partners/types";

function ordersHref(partnerId: string, purchase: boolean, ownerId?: string | null, currencyCode?: string) {
  const params = new URLSearchParams({ view: "orders", partnerId, locationId: "all" });
  if (ownerId !== undefined) params.set("ownerId", ownerId ?? "unassigned");
  if (currencyCode) params.set("currencyCode", currencyCode);
  return `/admin/${purchase ? "purchasing" : "sales"}?${params}`;
}

function money(value: number, currencyCode: string) {
  return `${currencyCode} ${minorToDisplay(value)}`;
}

export function PartnerFinancialOverview({ partner }: { partner: PartnerDetailRecord }) {
  const { financial } = partner;
  return (
    <section className="mb-6 flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        {[
          { visible: partner.isCustomer, label: "Sales", count: financial.salesCount, href: ordersHref(partner.id, false), Icon: FileText },
          { visible: partner.isSupplier, label: "Purchases", count: financial.purchaseCount, href: ordersHref(partner.id, true), Icon: Receipt },
        ].filter((item) => item.visible).map(({ label, count, href, Icon }) => (
          <Link key={label} href={href} className="group flex min-h-14 w-[164px] items-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5 transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"><Icon className="size-3.5" aria-hidden="true" /></span>
            <span className="flex flex-1 flex-col gap-0.5">
              <span className="text-sm font-bold leading-4 text-foreground">{count}</span>
              <span className="text-[10px] leading-3 text-muted-foreground"><T k={label} /></span>
            </span>
            <ArrowUpRight className="size-3 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" aria-hidden="true" />
          </Link>
        ))}
      </div>
      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {([
          ["Customer unpaid", financial.receivableResidualMinor, "border-l-financial-receivable"],
          ["Available credit", financial.remainingCreditMinor, "border-l-financial-credit"],
          ["Supplier unpaid", financial.payableResidualMinor, "border-l-financial-payable"],
          ["Net balance", financial.netBalanceMinor, "border-l-financial-net"],
        ] as const).map(([label, amount, accent]) => (
          <div key={label} className={cn("min-h-[58px] rounded-lg border border-border border-l-2 bg-card px-3 py-2.5 shadow-xs", accent)}>
            <dt className="text-[10px] font-medium uppercase leading-3 tracking-wider text-muted-foreground"><T k={label} /></dt>
            <dd className={cn("mt-1 text-sm font-bold leading-5 tabular-nums text-foreground", label === "Net balance" && (amount < 0 ? "text-destructive" : "text-financial-net"))}>{money(amount, partner.currencyCode)}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-1 overflow-hidden rounded-lg border border-border bg-card">
        <div className="flex flex-col gap-1 border-b border-border p-4">
          <h2 className="text-sm font-semibold"><T k="Balances by order owner" /></h2>
          <p className="text-xs text-muted-foreground"><T k="Counts include all unarchived orders. Unpaid balances use confirmed orders and posted payments across all shops. Available credit is shared across owners. Amounts are kept in their order currency." /></p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
              <tr>
                {["Owner", "Currency", "Sales", "Purchases", "Customer unpaid", "Supplier unpaid", "Net balance"].map((label, index) => <th key={label} scope="col" className={index > 1 ? "px-4 py-3 text-right" : "px-4 py-3"}><T k={label} /></th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {financial.byOwner.map((row) => (
                <tr key={`${row.ownerId ?? "unassigned"}-${row.currencyCode}`}>
                  <th scope="row" className="px-4 py-3 font-medium">{row.ownerId ? row.ownerName : <T k="Unassigned" />}</th>
                  <td className="px-4 py-3">{row.currencyCode}</td>
                  <td className="px-4 py-3 text-right"><Link className="text-primary underline-offset-4 hover:underline" href={ordersHref(partner.id, false, row.ownerId, row.currencyCode)} aria-label={`Sales — ${row.ownerName} (${row.currencyCode})`}>{row.salesCount}</Link></td>
                  <td className="px-4 py-3 text-right"><Link className="text-primary underline-offset-4 hover:underline" href={ordersHref(partner.id, true, row.ownerId, row.currencyCode)} aria-label={`Purchases — ${row.ownerName} (${row.currencyCode})`}>{row.purchaseCount}</Link></td>
                  <td className="px-4 py-3 text-right font-mono text-xs">{money(row.receivableResidualMinor, row.currencyCode)}</td>
                  <td className="px-4 py-3 text-right font-mono text-xs">{money(row.payableResidualMinor, row.currencyCode)}</td>
                  <td className="px-4 py-3 text-right font-mono text-xs font-semibold">{money(row.netBalanceMinor, row.currencyCode)}</td>
                </tr>
              ))}
              {financial.byOwner.length === 0 ? <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground"><T k="No owners or orders found." /></td></tr> : null}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
