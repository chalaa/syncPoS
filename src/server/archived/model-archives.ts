import "server-only";

import { sql, type SQL } from "drizzle-orm";

import { db } from "@/server/db/client";
import { getSelectedShopId } from "@/server/locations/shop-options";

type Definition = {
  table: string; reference: string; amount: string | SQL; joins: SQL; party: SQL; location: SQL; currency?: SQL;
  parentId?: SQL; parentReference?: SQL; parentType?: "sales_order" | "purchase_order"; direction?: "inbound" | "outbound";
  status?: SQL;
};
const models = {
  sales_order: { table: "sales_orders", reference: "order_no", amount: "total_minor", joins: sql`left join partners party on party.id = r.customer_id`, party: sql`party.display_name`, location: sql`r.source_location_id`, parentType: "sales_order", parentId: sql`r.id`, parentReference: sql`r.order_no` },
  purchase_order: { table: "purchase_orders", reference: "order_no", amount: "total_minor", joins: sql`left join partners party on party.id = r.supplier_id`, party: sql`party.display_name`, location: sql`r.deliver_to_location_id`, parentType: "purchase_order", parentId: sql`r.id`, parentReference: sql`r.order_no` },
  delivery: { table: "deliveries", reference: "delivery_no", amount: sql`(select coalesce(sum(l.total_cost_minor), 0) from delivery_lines l where l.delivery_id = r.id and (l.deleted_at is null or l.delete_reason = r.delete_reason))`, currency: sql`parent.currency_code`, joins: sql`left join partners party on party.id = r.customer_id left join sales_orders parent on parent.id = r.sales_order_id`, party: sql`party.display_name`, location: sql`r.source_location_id`, parentType: "sales_order", parentId: sql`parent.id`, parentReference: sql`parent.order_no` },
  receipt: { table: "goods_receipts", reference: "receipt_no", amount: sql`(select coalesce(sum(l.line_total_minor), 0) from goods_receipt_lines l where l.goods_receipt_id = r.id and (l.deleted_at is null or l.delete_reason = r.delete_reason))`, currency: sql`parent.currency_code`, joins: sql`left join partners party on party.id = r.supplier_id left join purchase_orders parent on parent.id = r.purchase_order_id`, party: sql`party.display_name`, location: sql`r.location_id`, parentType: "purchase_order", parentId: sql`parent.id`, parentReference: sql`parent.order_no` },
  customer_invoice: { table: "customer_invoices", reference: "invoice_no", amount: "total_minor", joins: sql`left join partners party on party.id = r.customer_id left join sales_orders parent on parent.id = r.sales_order_id`, party: sql`party.display_name`, location: sql`parent.source_location_id`, parentType: "sales_order", parentId: sql`parent.id`, parentReference: sql`parent.order_no` },
  landed_cost: { table: "landed_costs", reference: "cost_no", amount: "amount_minor", joins: sql`left join partners party on party.id = r.vendor_id left join goods_receipts receipt on receipt.id = r.goods_receipt_id left join purchase_orders parent on parent.id = coalesce(r.purchase_order_id, receipt.purchase_order_id)`, party: sql`party.display_name`, location: sql`coalesce(parent.deliver_to_location_id, receipt.location_id)`, parentType: "purchase_order", parentId: sql`parent.id`, parentReference: sql`parent.order_no` },
  customer_return: { table: "customer_returns", reference: "return_no", amount: "refund_amount_minor", joins: sql`left join partners party on party.id = r.customer_id left join sales_orders parent on parent.id = r.sales_order_id`, party: sql`party.display_name`, location: sql`parent.source_location_id`, parentType: "sales_order", parentId: sql`parent.id`, parentReference: sql`parent.order_no` },
  supplier_return: { table: "supplier_returns", reference: "return_no", amount: "refund_amount_minor", joins: sql`left join partners party on party.id = r.supplier_id left join purchase_orders parent on parent.id = r.purchase_order_id`, party: sql`party.display_name`, location: sql`coalesce(parent.deliver_to_location_id, r.source_location_id)`, parentType: "purchase_order", parentId: sql`parent.id`, parentReference: sql`parent.order_no` },
  direct_vendor_sale: { table: "direct_vendor_sales", reference: "sale_no", amount: "customer_total_minor", joins: sql`left join partners customer on customer.id = r.customer_id left join partners vendor on vendor.id = r.vendor_id`, party: sql`concat_ws(' / ', customer.display_name, vendor.display_name)`, location: sql`null::uuid` },
  expense: { table: "expenses", reference: "expense_no", amount: "amount_minor", joins: sql`left join partners party on party.id = r.vendor_id left join employees employee on employee.id = r.employee_id`, party: sql`coalesce(party.display_name, employee.full_name)`, location: sql`r.location_id` },
  role: { table: "roles", reference: "code", amount: "", joins: sql``, party: sql`r.name`, location: sql`null::uuid`, status: sql`case when r.is_active then 'active' else 'inactive' end` },
} satisfies Record<string, Definition>;

const paymentJoins = sql`
  left join partners party on party.id = r.partner_id
  left join lateral (
    select coalesce(so.id, po.id, ci.sales_order_id, vb.purchase_order_id) as id,
      coalesce(so.order_no, po.order_no, invoice_order.order_no, bill_order.order_no, dvs.sale_no) as order_no,
      coalesce(so.deleted_at, po.deleted_at, invoice_order.deleted_at, bill_order.deleted_at) as deleted_at,
      coalesce(so.source_location_id, po.deliver_to_location_id, invoice_order.source_location_id, bill_order.deliver_to_location_id, e.location_id) as location_id
    from payment_allocations a
    left join sales_orders so on so.id = a.sales_order_id
    left join purchase_orders po on po.id = a.purchase_order_id
    left join customer_invoices ci on ci.id = a.customer_invoice_id
    left join vendor_bills vb on vb.id = a.vendor_bill_id
    left join sales_orders invoice_order on invoice_order.id = ci.sales_order_id
    left join purchase_orders bill_order on bill_order.id = vb.purchase_order_id
    left join expenses e on e.id = a.expense_id
    left join direct_vendor_sales dvs on dvs.id = coalesce(a.customer_direct_vendor_sale_id, a.vendor_direct_vendor_sale_id)
    where a.payment_id = r.id
    order by (a.delete_reason = r.delete_reason) desc nulls last, a.created_at limit 1
  ) parent on true
`;

export type ArchivedModel = keyof typeof models | "customer_payment" | "supplier_payment";
export type ArchiveListParams = {
  q?: string; status?: string; page?: string; pageSize?: string; locationId?: string | null;
  salesOrderId?: string; purchaseOrderId?: string; directVendorSaleId?: string; customerInvoiceId?: string; vendorBillId?: string;
  paymentTerm?: string; paymentStatus?: string; customerPaymentTerm?: string; vendorPaymentTerm?: string; costType?: string; category?: string;
};
export type ArchivedModelRow = {
  id: string; reference: string; party: string | null; status: string; amountMinor: number | null; currencyCode: string | null;
  archivedAt: string; parentId: string | null; parentReference: string | null; parentType?: "sales_order" | "purchase_order";
  parentArchived: boolean;
};
export type ExpenseArchiveScope = { userId: string; employeeId?: string | null; canSeeAll: boolean };

export async function getArchivedModelRows(model: ArchivedModel, companyId: string, params: ArchiveListParams, executor: Pick<typeof db, "execute"> = db, expenseScope?: ExpenseArchiveScope): Promise<ArchivedModelRow[]> {
  const payment = model === "customer_payment" || model === "supplier_payment";
  const def: Definition = payment
    ? { table: "payments", reference: "payment_no", amount: "amount_minor", joins: paymentJoins, party: sql`party.display_name`, location: sql`parent.location_id`, parentId: sql`parent.id`, parentReference: sql`parent.order_no`, parentType: model === "customer_payment" ? "sales_order" : "purchase_order", direction: model === "customer_payment" ? "inbound" : "outbound" }
    : models[model];
  const locationId = params.locationId === undefined ? await getSelectedShopId() : params.locationId;
  const amount = typeof def.amount === "string" ? def.amount ? sql`r.${sql.identifier(def.amount)}` : sql`null::bigint` : def.amount;
  const parentId = params.salesOrderId || params.purchaseOrderId;
  const extraFilters: SQL[] = [];
  if (model === "expense") {
    if (!expenseScope) throw new Error("Expense archive access scope is required.");
    if (!expenseScope.canSeeAll) extraFilters.push(expenseScope.employeeId
      ? sql`(r.created_by = ${expenseScope.userId} or r.employee_id = ${expenseScope.employeeId})`
      : sql`r.created_by = ${expenseScope.userId}`);
  }
  if (def.direction) extraFilters.push(sql`r.payment_type = ${def.direction}::payment_type`);
  if (params.paymentTerm && (model === "sales_order" || model === "purchase_order")) extraFilters.push(sql`r.payment_term::text = ${params.paymentTerm}`);
  if (params.costType && model === "landed_cost") extraFilters.push(sql`r.cost_type::text = ${params.costType}`);
  if (params.category && model === "expense") extraFilters.push(sql`r.category_id = ${params.category}::uuid`);
  if (model === "direct_vendor_sale") {
    if (params.customerPaymentTerm) extraFilters.push(sql`r.customer_payment_term::text = ${params.customerPaymentTerm}`);
    if (params.vendorPaymentTerm) extraFilters.push(sql`r.vendor_payment_term::text = ${params.vendorPaymentTerm}`);
  }
  if (params.paymentStatus && ["sales_order", "purchase_order", "customer_invoice", "expense"].includes(model)) {
    const allocationColumn = { sales_order: "sales_order_id", purchase_order: "purchase_order_id", customer_invoice: "customer_invoice_id", expense: "expense_id" }[model as "sales_order" | "purchase_order" | "customer_invoice" | "expense"];
    const paid = sql`(select coalesce(sum(a.amount_minor), 0) from payment_allocations a inner join payments p on p.id = a.payment_id
      where a.${sql.identifier(allocationColumn)} = r.id and p.status = 'posted'
        and (a.deleted_at is null or a.delete_reason = r.delete_reason) and (p.deleted_at is null or p.delete_reason = r.delete_reason))`;
    const total = amount;
    if (["paid", "fully_paid"].includes(params.paymentStatus)) extraFilters.push(sql`${paid} >= ${total}`);
    if (["unpaid", "not_paid"].includes(params.paymentStatus)) extraFilters.push(sql`${paid} <= 0 and ${total} > 0`);
    if (["partial", "partially_paid"].includes(params.paymentStatus)) extraFilters.push(sql`${paid} > 0 and ${paid} < ${total}`);
  }
  if (parentId && def.parentId) extraFilters.push(sql`${def.parentId} = ${parentId}::uuid`);
  if (payment) {
    for (const [value, column] of [[params.customerInvoiceId, "customer_invoice_id"], [params.vendorBillId, "vendor_bill_id"]] as const) {
      if (value) extraFilters.push(sql`exists(select 1 from payment_allocations a where a.payment_id = r.id and a.${sql.identifier(column)} = ${value}::uuid)`);
    }
    if (params.directVendorSaleId) extraFilters.push(sql`exists(select 1 from payment_allocations a where a.payment_id = r.id
      and (a.customer_direct_vendor_sale_id = ${params.directVendorSaleId}::uuid or a.vendor_direct_vendor_sale_id = ${params.directVendorSaleId}::uuid))`);
  }
  const rows = await executor.execute<ArchivedModelRow>(sql`
    with archived as (
      select r.id, coalesce(r.${sql.identifier(def.reference)}, r.id::text) as reference, ${def.party} as party, ${def.status ?? sql`r.status::text`} as status,
        ${amount} as "amountMinor", ${def.currency ?? (def.amount ? sql`r.currency_code` : sql`null::text`)} as "currencyCode",
        r.deleted_at::text as "archivedAt", ${def.parentId ?? sql`null::uuid`} as "parentId", ${def.parentReference ?? sql`null::text`} as "parentReference",
        ${model === "sales_order" || model === "purchase_order" ? sql`true` : def.parentId ? sql`parent.deleted_at is not null` : sql`false`} as "parentArchived"
      from ${sql.identifier(def.table)} r ${def.joins}
      where r.company_id = ${companyId} and r.deleted_at is not null
        ${locationId && model !== "direct_vendor_sale" && model !== "role" && !params.directVendorSaleId ? sql`and ${def.location} = ${locationId}::uuid` : sql``}
        ${extraFilters.length ? sql`and ${sql.join(extraFilters, sql` and `)}` : sql``}
    )
    select * from archived
    where (${params.status ?? ""} = '' or status = ${params.status ?? ""})
      and (${params.q?.trim() ?? ""} = '' or reference ilike ${`%${params.q?.trim() ?? ""}%`} or party ilike ${`%${params.q?.trim() ?? ""}%`} or "parentReference" ilike ${`%${params.q?.trim() ?? ""}%`})
    order by "archivedAt"::timestamptz desc, id
  `);
  return rows.map((row) => ({ ...row, amountMinor: row.amountMinor == null ? null : Number(row.amountMinor), parentType: def.parentType }));
}
