import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/server/db/client";

export async function getPostedPaymentEditableLimit(paymentId: string) {
  const [row] = await db.execute<{ limitMinor: number }>(sql`
    with target as (
      select
        pa.sales_order_id,
        pa.customer_invoice_id,
        pa.customer_direct_vendor_sale_id,
        pa.purchase_order_id,
        pa.vendor_bill_id,
        pa.vendor_direct_vendor_sale_id,
        coalesce(
          so.total_minor,
          ci.total_minor,
          cdvs.customer_total_minor,
          po.total_minor,
          vb.total_minor,
          vdvs.vendor_cost_total_minor
        ) as total_minor
      from payment_allocations pa
      left join sales_orders so on so.id = pa.sales_order_id and so.deleted_at is null
      left join customer_invoices ci on ci.id = pa.customer_invoice_id and ci.deleted_at is null
      left join direct_vendor_sales cdvs on cdvs.id = pa.customer_direct_vendor_sale_id and cdvs.deleted_at is null
      left join purchase_orders po on po.id = pa.purchase_order_id and po.deleted_at is null
      left join vendor_bills vb on vb.id = pa.vendor_bill_id and vb.deleted_at is null
      left join direct_vendor_sales vdvs on vdvs.id = pa.vendor_direct_vendor_sale_id and vdvs.deleted_at is null
      where pa.payment_id = ${paymentId} and pa.deleted_at is null
      limit 1
    )
    select greatest(
      target.total_minor - coalesce((
        select sum(other_allocation.amount_minor)
        from payment_allocations other_allocation
        inner join payments other_payment on other_payment.id = other_allocation.payment_id
        where other_payment.id <> ${paymentId}
          and other_payment.status = 'posted'
          and other_payment.deleted_at is null
          and other_allocation.deleted_at is null
          and (
            other_allocation.sales_order_id = target.sales_order_id
            or other_allocation.customer_invoice_id = target.customer_invoice_id
            or other_allocation.customer_direct_vendor_sale_id = target.customer_direct_vendor_sale_id
            or other_allocation.purchase_order_id = target.purchase_order_id
            or other_allocation.vendor_bill_id = target.vendor_bill_id
            or other_allocation.vendor_direct_vendor_sale_id = target.vendor_direct_vendor_sale_id
          )
      ), 0),
      0
    )::bigint as "limitMinor"
    from target
  `);

  return row?.limitMinor === undefined ? null : Number(row.limitMinor);
}
