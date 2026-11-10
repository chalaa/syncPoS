import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/server/db/client";
import type { PartnerFinancialSummary, PartnerOwnerBalance } from "@/server/partners/types";

export async function getPartnerOrderBalances(
  companyId: string,
  partnerId: string,
  currencyCode: string,
  creditLimitMinor: number,
  executor: Pick<typeof db, "execute"> = db,
): Promise<PartnerFinancialSummary> {
  const rows = await executor.execute<PartnerOwnerBalance>(sql`
    with orders as (
      select so.owner_id, so.currency_code, 'sale' as kind, so.status::text as status,
        greatest(so.total_minor - coalesce(paid.amount, 0), 0) as unpaid
      from sales_orders so
      left join lateral (
        select sum(a.amount_minor) as amount
        from payment_allocations a inner join payments p on p.id = a.payment_id
        where a.sales_order_id = so.id and a.deleted_at is null
          and p.company_id = ${companyId} and p.payment_type = 'inbound'
          and p.deleted_at is null and p.status = 'posted'
      ) paid on true
      where so.company_id = ${companyId} and so.customer_id = ${partnerId} and so.deleted_at is null
      union all
      select po.owner_id, po.currency_code, 'purchase', po.status::text,
        greatest(po.total_minor - coalesce(paid.amount, 0), 0)
      from purchase_orders po
      left join lateral (
        select sum(a.amount_minor) as amount
        from payment_allocations a inner join payments p on p.id = a.payment_id
        where a.purchase_order_id = po.id and a.deleted_at is null
          and p.company_id = ${companyId} and p.payment_type = 'outbound'
          and p.deleted_at is null and p.status = 'posted'
      ) paid on true
      where po.company_id = ${companyId} and po.supplier_id = ${partnerId} and po.deleted_at is null
    ), balances as (
      select owner_id, currency_code,
        count(*) filter (where kind = 'sale')::int as sales_count,
        count(*) filter (where kind = 'purchase')::int as purchase_count,
        coalesce(sum(unpaid) filter (where kind = 'sale' and status not in ('quotation', 'cancelled')), 0)::bigint as receivable,
        coalesce(sum(unpaid) filter (where kind = 'purchase' and status not in ('draft', 'cancelled')), 0)::bigint as payable
      from orders group by owner_id, currency_code
    ), owner_groups as (
      select id as owner_id, name as owner_name, ${currencyCode}::text as currency_code
      from owners where company_id = ${companyId} and deleted_at is null
      union
      select b.owner_id, coalesce(o.name, 'Unassigned'), b.currency_code
      from balances b left join owners o on o.id = b.owner_id and o.company_id = ${companyId}
    )
    select g.owner_id as "ownerId", g.owner_name as "ownerName", g.currency_code as "currencyCode",
      coalesce(b.sales_count, 0)::int as "salesCount", coalesce(b.purchase_count, 0)::int as "purchaseCount",
      coalesce(b.receivable, 0)::bigint as "receivableResidualMinor", coalesce(b.payable, 0)::bigint as "payableResidualMinor",
      (coalesce(b.receivable, 0) - coalesce(b.payable, 0))::bigint as "netBalanceMinor"
    from owner_groups g left join balances b on b.owner_id is not distinct from g.owner_id and b.currency_code = g.currency_code
    order by g.owner_name, g.owner_id nulls last, g.currency_code
  `);
  const byOwner = rows.map((row) => ({ ...row,
    salesCount: Number(row.salesCount), purchaseCount: Number(row.purchaseCount),
    receivableResidualMinor: Number(row.receivableResidualMinor), payableResidualMinor: Number(row.payableResidualMinor),
    netBalanceMinor: Number(row.netBalanceMinor),
  }));
  const currencyRows = byOwner.filter((row) => row.currencyCode === currencyCode);
  const receivableResidualMinor = currencyRows.reduce((total, row) => total + row.receivableResidualMinor, 0);
  const payableResidualMinor = currencyRows.reduce((total, row) => total + row.payableResidualMinor, 0);
  return {
    salesCount: byOwner.reduce((total, row) => total + row.salesCount, 0),
    purchaseCount: byOwner.reduce((total, row) => total + row.purchaseCount, 0),
    receivableResidualMinor, payableResidualMinor,
    remainingCreditMinor: Math.max(creditLimitMinor - receivableResidualMinor, 0),
    netBalanceMinor: receivableResidualMinor - payableResidualMinor,
    byOwner,
  };
}
