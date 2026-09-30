import "server-only";

import { sql } from "drizzle-orm";

import { displayReportMoney } from "@/lib/report-formatters";
import { getDefaultCompany } from "@/server/catalog/products";
import { db } from "@/server/db/client";
import { getSelectedShopId } from "@/server/locations/shop-options";
import type {
  DashboardPaymentAccount,
  DashboardRecentActivity,
  DashboardReport,
  ExpenseReportRow,
  PayableReportRow,
  PaymentAccountStatementRow,
  PaymentReportRow,
  ReceivableReportRow,
  ReportFilters,
  ReportSummary,
  SalesReportRow,
  StockReportRow,
} from "@/server/reports/types";

export function normalizeReportFilters(params: {
  dateFrom?: string;
  dateTo?: string;
  q?: string;
  status?: string;
  paymentType?: string;
  paymentAccountId?: string;
  locationId?: string;
}): ReportFilters {
  const paymentType =
    params.paymentType === "inbound" || params.paymentType === "outbound"
      ? params.paymentType
      : undefined;

  return {
    dateFrom: params.dateFrom?.trim() || undefined,
    dateTo: params.dateTo?.trim() || undefined,
    query: params.q?.trim() || undefined,
    status: params.status?.trim() || undefined,
    paymentType,
    paymentAccountId: params.paymentAccountId?.trim() || undefined,
    locationId: params.locationId?.trim() || undefined,
  };
}

export function summarizeMoney<T extends { totalMinor?: number; amountMinor?: number; paidAmountMinor?: number; residualAmountMinor?: number; currencyCode: string }>(
  rows: T[],
): ReportSummary {
  const currencyCode = rows[0]?.currencyCode ?? "ETB";

  return rows.reduce<ReportSummary>(
    (summary, row) => ({
      count: summary.count + 1,
      totalMinor: summary.totalMinor + (row.totalMinor ?? row.amountMinor ?? 0),
      paidMinor: (summary.paidMinor ?? 0) + (row.paidAmountMinor ?? 0),
      residualMinor: (summary.residualMinor ?? 0) + (row.residualAmountMinor ?? 0),
      currencyCode,
    }),
    { count: 0, totalMinor: 0, paidMinor: 0, residualMinor: 0, currencyCode },
  );
}

export function parseValidLocationId(rawLocId?: string | null): string | null {
  if (!rawLocId || rawLocId === "all") return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawLocId) ? rawLocId : null;
}

export async function getDashboardReport(overrideLocationId?: string | null): Promise<DashboardReport> {
  const company = await getDefaultCompany();
  const today = new Date().toISOString().slice(0, 10);
  const locationIdRaw = overrideLocationId !== undefined ? overrideLocationId : await getSelectedShopId();
  const validLocId = parseValidLocationId(locationIdRaw);

  const salesLocFilter = validLocId
    ? sql` and (so.source_location_id = ${validLocId}::uuid or d.source_location_id = ${validLocId}::uuid)`
    : sql``;

  const custPaymentLocFilter = validLocId
    ? sql` and exists (
        select 1
        from payment_allocations pa
        left join customer_invoices ci on ci.id = pa.customer_invoice_id
        left join deliveries d on d.id = ci.delivery_id
        left join sales_orders so on so.id = ci.sales_order_id or so.id = pa.sales_order_id
        where pa.payment_id = p.id
          and pa.deleted_at is null
          and (so.source_location_id = ${validLocId}::uuid or d.source_location_id = ${validLocId}::uuid)
      )`
    : sql``;

  const expenseLocFilter = validLocId
    ? sql` and e.location_id = ${validLocId}::uuid`
    : sql``;

  const supplierPaymentLocFilter = validLocId
    ? sql` and exists (
        select 1
        from payment_allocations pa
        left join vendor_bills vb on vb.id = pa.vendor_bill_id
        left join goods_receipts gr on gr.id = vb.goods_receipt_id
        left join purchase_orders po on po.id = vb.purchase_order_id or po.id = pa.purchase_order_id
        left join expenses ex on ex.id = pa.expense_id
        where pa.payment_id = p.id
          and pa.deleted_at is null
          and (po.deliver_to_location_id = ${validLocId}::uuid or gr.location_id = ${validLocId}::uuid or ex.location_id = ${validLocId}::uuid)
      )`
    : sql``;

  const recLocFilter = validLocId
    ? sql` and (so.source_location_id = ${validLocId}::uuid or d.source_location_id = ${validLocId}::uuid)`
    : sql``;

  const payLocFilter = validLocId
    ? sql` and (po.deliver_to_location_id = ${validLocId}::uuid or gr.location_id = ${validLocId}::uuid)`
    : sql``;

  const stockLocFilter = validLocId
    ? sql` and sb.location_id = ${validLocId}::uuid`
    : sql``;

  const poLocFilter = validLocId
    ? sql` and po.deliver_to_location_id = ${validLocId}::uuid`
    : sql``;

  const grLocFilter = validLocId
    ? sql` and gr.location_id = ${validLocId}::uuid`
    : sql``;

  const recentInvoiceLocFilter = validLocId
    ? sql` and (so.source_location_id = ${validLocId}::uuid or d.source_location_id = ${validLocId}::uuid)`
    : sql``;

  const recentBillLocFilter = validLocId
    ? sql` and (po.deliver_to_location_id = ${validLocId}::uuid or gr.location_id = ${validLocId}::uuid)`
    : sql``;

  const recentPaymentLocFilter = validLocId
    ? sql` and exists (
        select 1
        from payment_allocations pa
        left join sales_orders so on so.id = pa.sales_order_id
        left join customer_invoices ci on ci.id = pa.customer_invoice_id
        left join sales_orders ciso on ciso.id = ci.sales_order_id
        left join deliveries cid on cid.id = ci.delivery_id
        left join purchase_orders po on po.id = pa.purchase_order_id
        left join vendor_bills vb on vb.id = pa.vendor_bill_id
        left join purchase_orders vbpo on vbpo.id = vb.purchase_order_id
        left join goods_receipts vbgr on vbgr.id = vb.goods_receipt_id
        left join expenses ex on ex.id = pa.expense_id
        where pa.payment_id = p.id
          and pa.deleted_at is null
          and (so.source_location_id = ${validLocId}::uuid or ciso.source_location_id = ${validLocId}::uuid or cid.source_location_id = ${validLocId}::uuid or po.deliver_to_location_id = ${validLocId}::uuid or vbpo.deliver_to_location_id = ${validLocId}::uuid or vbgr.location_id = ${validLocId}::uuid or ex.location_id = ${validLocId}::uuid)
      )`
    : sql``;

  const salesOrderLocFilter = validLocId
    ? sql` and so.source_location_id = ${validLocId}::uuid`
    : sql``;

  const [summary] = await db.execute<{
    salesTodayMinor: number;
    salesUnpaidTodayMinor: number;
    purchasesTodayMinor: number;
    purchasesUnpaidTodayMinor: number;
    expensesTodayMinor: number;
    currencyCode: string;
  }>(sql`
    select
      coalesce((
        select sum(total) from (
          select so.total_minor as total
          from sales_orders so
          where so.company_id = ${company.id}
            and so.deleted_at is null
            and so.status <> 'cancelled'
            and (so.order_date = ${today}::date or so.created_at::date = ${today}::date)
            ${salesOrderLocFilter}
          union all
          select ci.total_minor as total
          from customer_invoices ci
          left join sales_orders so on so.id = ci.sales_order_id
          left join deliveries d on d.id = ci.delivery_id
          where ci.company_id = ${company.id}
            and ci.deleted_at is null
            and ci.status <> 'cancelled'
            and ci.sales_order_id is null
            and (ci.invoice_date = ${today}::date or ci.created_at::date = ${today}::date)
            ${salesLocFilter}
        ) s
      ), 0)::bigint as "salesTodayMinor",
      coalesce((
        select sum(unpaid) from (
          select greatest(so.total_minor - coalesce((
            select sum(pa.amount_minor)
            from payment_allocations pa
            inner join payments p on p.id = pa.payment_id
            where (pa.sales_order_id = so.id or pa.customer_invoice_id in (select ci.id from customer_invoices ci where ci.sales_order_id = so.id))
              and pa.deleted_at is null
              and p.deleted_at is null
              and p.status = 'posted'
          ), 0), 0) as unpaid
          from sales_orders so
          where so.company_id = ${company.id}
            and so.deleted_at is null
            and so.status <> 'cancelled'
            and (so.order_date = ${today}::date or so.created_at::date = ${today}::date)
            ${salesOrderLocFilter}
          union all
          select greatest(ci.total_minor - coalesce((
            select sum(pa.amount_minor)
            from payment_allocations pa
            inner join payments p on p.id = pa.payment_id
            where pa.customer_invoice_id = ci.id
              and pa.deleted_at is null
              and p.deleted_at is null
              and p.status = 'posted'
          ), 0), 0) as unpaid
          from customer_invoices ci
          left join sales_orders so on so.id = ci.sales_order_id
          left join deliveries d on d.id = ci.delivery_id
          where ci.company_id = ${company.id}
            and ci.deleted_at is null
            and ci.status <> 'cancelled'
            and ci.sales_order_id is null
            and (ci.invoice_date = ${today}::date or ci.created_at::date = ${today}::date)
            ${salesLocFilter}
        ) su
      ), 0)::bigint as "salesUnpaidTodayMinor",
      coalesce((
        select sum(total) from (
          select po.total_minor as total
          from purchase_orders po
          where po.company_id = ${company.id}
            and po.deleted_at is null
            and po.status <> 'cancelled'
            and (po.order_date = ${today}::date or po.created_at::date = ${today}::date)
            ${poLocFilter}
          union all
          select vb.total_minor as total
          from vendor_bills vb
          left join purchase_orders po on po.id = vb.purchase_order_id
          left join goods_receipts gr on gr.id = vb.goods_receipt_id
          where vb.company_id = ${company.id}
            and vb.deleted_at is null
            and vb.status <> 'cancelled'
            and vb.purchase_order_id is null
            and (vb.bill_date = ${today}::date or vb.created_at::date = ${today}::date)
            ${payLocFilter}
        ) p_tot
      ), 0)::bigint as "purchasesTodayMinor",
      coalesce((
        select sum(unpaid) from (
          select greatest(po.total_minor - coalesce((
            select sum(pa.amount_minor)
            from payment_allocations pa
            inner join payments p on p.id = pa.payment_id
            where (pa.purchase_order_id = po.id or pa.vendor_bill_id in (select vb.id from vendor_bills vb where vb.purchase_order_id = po.id))
              and pa.deleted_at is null
              and p.deleted_at is null
              and p.status = 'posted'
          ), 0), 0) as unpaid
          from purchase_orders po
          where po.company_id = ${company.id}
            and po.deleted_at is null
            and po.status <> 'cancelled'
            and (po.order_date = ${today}::date or po.created_at::date = ${today}::date)
            ${poLocFilter}
          union all
          select greatest(vb.total_minor - coalesce((
            select sum(pa.amount_minor)
            from payment_allocations pa
            inner join payments p on p.id = pa.payment_id
            where pa.vendor_bill_id = vb.id
              and pa.deleted_at is null
              and p.deleted_at is null
              and p.status = 'posted'
          ), 0), 0) as unpaid
          from vendor_bills vb
          left join purchase_orders po on po.id = vb.purchase_order_id
          left join goods_receipts gr on gr.id = vb.goods_receipt_id
          where vb.company_id = ${company.id}
            and vb.deleted_at is null
            and vb.status <> 'cancelled'
            and vb.purchase_order_id is null
            and (vb.bill_date = ${today}::date or vb.created_at::date = ${today}::date)
            ${payLocFilter}
        ) pu
      ), 0)::bigint as "purchasesUnpaidTodayMinor",
      coalesce((
        select sum(e.amount_minor)
        from expenses e
        where e.company_id = ${company.id}
          and e.deleted_at is null
          and e.status <> 'cancelled'
          and (e.expense_date = ${today}::date or e.created_at::date = ${today}::date)
          ${expenseLocFilter}
      ), 0)::bigint as "expensesTodayMinor",
      ${company.baseCurrencyCode}::text as "currencyCode"
  `);

  const paymentAccounts = await db.execute<DashboardPaymentAccount>(sql`
    select
      pa.id as "id",
      pa.code as "code",
      pa.name as "name",
      pa.institution_name as "institutionName",
      pa.currency_code as "currencyCode",
      pa.opening_balance_minor as "openingBalanceMinor",
      coalesce(sum(p.amount_minor) filter (where p.status = 'posted' and p.payment_type = 'inbound' and p.deleted_at is null), 0)::bigint as "inboundMinor",
      coalesce(sum(p.amount_minor) filter (where p.status = 'posted' and p.payment_type = 'outbound' and p.deleted_at is null), 0)::bigint as "outboundMinor",
      (pa.opening_balance_minor
        + coalesce(sum(p.amount_minor) filter (where p.status = 'posted' and p.payment_type = 'inbound' and p.deleted_at is null), 0)
        - coalesce(sum(p.amount_minor) filter (where p.status = 'posted' and p.payment_type = 'outbound' and p.deleted_at is null), 0)
      )::bigint as "netBalanceMinor"
    from payment_accounts pa
    left join payments p on p.payment_account_id = pa.id
    where pa.company_id = ${company.id}
      and pa.deleted_at is null
    group by pa.id
    order by pa.name asc
    limit 8
  `);

  const recentActivity = await db.execute<DashboardRecentActivity>(sql`
    select * from (
      select ci.id, ci.invoice_no as "documentNo", 'Customer invoice' as "activityType", ci.invoice_date::text as "activityDate", customer.display_name as "partyName", ci.total_minor as "amountMinor", ci.currency_code as "currencyCode", '/admin/sales/invoices/' || ci.id::text as "href"
      from customer_invoices ci
      inner join partners customer on customer.id = ci.customer_id
      left join sales_orders so on so.id = ci.sales_order_id
      left join deliveries d on d.id = ci.delivery_id
      where ci.company_id = ${company.id}
        and ci.deleted_at is null
        ${recentInvoiceLocFilter}
      union all
      select vb.id, vb.bill_no as "documentNo", 'Vendor bill' as "activityType", vb.bill_date::text as "activityDate", supplier.display_name as "partyName", vb.total_minor as "amountMinor", vb.currency_code as "currencyCode", '/admin/purchasing/vendor-bills/vendor_bill/' || vb.id::text as "href"
      from vendor_bills vb
      inner join partners supplier on supplier.id = vb.supplier_id
      left join purchase_orders po on po.id = vb.purchase_order_id
      left join goods_receipts gr on gr.id = vb.goods_receipt_id
      where vb.company_id = ${company.id}
        and vb.deleted_at is null
        ${recentBillLocFilter}
      union all
      select p.id, p.payment_no as "documentNo", case when p.payment_type = 'inbound' then 'Customer payment' else 'Supplier/expense payment' end as "activityType", p.payment_date::text as "activityDate", partner.display_name as "partyName", p.amount_minor as "amountMinor", p.currency_code as "currencyCode", case when p.payment_type = 'inbound' then '/admin/sales/payments/' || p.id::text else '/admin/purchasing/payments/' || p.id::text end as "href"
      from payments p
      left join partners partner on partner.id = p.partner_id
      where p.company_id = ${company.id}
        and p.deleted_at is null
        ${recentPaymentLocFilter}
    ) activity
    order by "activityDate" desc, "documentNo" desc
    limit 10
  `);

  const lowStock = await db.execute<DashboardReport["lowStock"][number]>(sql`
    select
      p.id as "productId",
      p.sku as "sku",
      p.name as "productName",
      l.code as "locationCode",
      sb.quantity_available as "quantityAvailable"
    from stock_balances sb
    inner join products p on p.id = sb.product_id
    inner join locations l on l.id = sb.location_id
    where sb.company_id = ${company.id}
      and sb.deleted_at is null
      and p.deleted_at is null
      and cast(sb.quantity_available as numeric) <= 0
      ${stockLocFilter}
    order by p.name asc, l.code asc
    limit 8
  `);

  const resolved = summary ?? {
    salesTodayMinor: 0,
    salesUnpaidTodayMinor: 0,
    purchasesTodayMinor: 0,
    purchasesUnpaidTodayMinor: 0,
    expensesTodayMinor: 0,
    currencyCode: company.baseCurrencyCode,
  };

  return {
    metrics: [
      { label: "Total Purchased", value: displayReportMoney(resolved.purchasesTodayMinor, resolved.currencyCode), href: "/admin/purchasing", tone: "warning" },
      { label: "Total Sales", value: displayReportMoney(resolved.salesTodayMinor, resolved.currencyCode), href: "/admin/sales", tone: "success" },
      { label: "Total Purchase Unpaid", value: displayReportMoney(resolved.purchasesUnpaidTodayMinor, resolved.currencyCode), href: "/admin/purchasing?paymentStatus=unpaid", tone: "danger" },
      { label: "Total Sales Unpaid", value: displayReportMoney(resolved.salesUnpaidTodayMinor, resolved.currencyCode), href: "/admin/sales?paymentStatus=unpaid", tone: "danger" },
      { label: "Total Expense", value: displayReportMoney(resolved.expensesTodayMinor, resolved.currencyCode), href: "/admin/operations/expenses", tone: "warning" },
    ],
    paymentAccounts,
    recentActivity,
    lowStock,
  };
}

export async function getSalesReport(filters: ReportFilters): Promise<SalesReportRow[]> {
  const company = await getDefaultCompany();
  const query = filters.query ?? "";
  const rawLocId = filters.locationId ?? await getSelectedShopId();
  const validLocId = parseValidLocationId(rawLocId);
  const locFilter = validLocId
    ? sql` and (so.source_location_id = ${validLocId}::uuid or loc.id = ${validLocId}::uuid)`
    : sql``;

  return db.execute<SalesReportRow>(sql`
    select
      ci.id as "id",
      ci.invoice_no as "invoiceNo",
      so.order_no as "orderNo",
      customer.display_name as "customerName",
      ci.status::text as "status",
      ci.payment_status::text as "paymentStatus",
      ci.invoice_date::text as "invoiceDate",
      loc.code as "locationCode",
      ci.untaxed_amount_minor as "untaxedAmountMinor",
      ci.tax_amount_minor as "taxAmountMinor",
      ci.total_minor as "totalMinor",
      coalesce(sum(pa.amount_minor) filter (where p.status = 'posted' and p.deleted_at is null and pa.deleted_at is null), 0)::bigint as "paidAmountMinor",
      case
        when ci.status = 'cancelled' then 0::bigint
        else greatest(ci.total_minor - coalesce(sum(pa.amount_minor) filter (where p.status = 'posted' and p.deleted_at is null and pa.deleted_at is null), 0), 0)::bigint
      end as "residualAmountMinor",
      ci.currency_code as "currencyCode"
    from customer_invoices ci
    inner join partners customer on customer.id = ci.customer_id
    left join sales_orders so on so.id = ci.sales_order_id
    left join locations loc on loc.id = so.source_location_id
    left join payment_allocations pa on pa.customer_invoice_id = ci.id
    left join payments p on p.id = pa.payment_id
    where ci.company_id = ${company.id}
      and ci.deleted_at is null
      ${locFilter}
      and (${filters.dateFrom ?? null}::date is null or ci.invoice_date >= ${filters.dateFrom ?? null}::date)
      and (${filters.dateTo ?? null}::date is null or ci.invoice_date <= ${filters.dateTo ?? null}::date)
      and (${filters.status ?? null}::text is null or ci.status::text = ${filters.status ?? null})
      and (${query} = '' or ci.invoice_no ilike ${`%${query}%`} or customer.display_name ilike ${`%${query}%`} or so.order_no ilike ${`%${query}%`})
    group by ci.id, so.id, customer.id, loc.id
    order by ci.invoice_date desc, ci.invoice_no desc
  `);
}

export async function getExpenseReport(filters: ReportFilters): Promise<ExpenseReportRow[]> {
  const company = await getDefaultCompany();
  const query = filters.query ?? "";
  const rawLocId = filters.locationId ?? await getSelectedShopId();
  const validLocId = parseValidLocationId(rawLocId);
  const locFilter = validLocId
    ? sql` and e.location_id = ${validLocId}::uuid`
    : sql``;

  return db.execute<ExpenseReportRow>(sql`
    select
      e.id as "id",
      e.expense_no as "expenseNo",
      e.status::text as "status",
      e.payment_status::text as "paymentStatus",
      e.expense_date::text as "expenseDate",
      ec.name as "categoryName",
      emp.full_name as "employeeName",
      vendor.display_name as "vendorName",
      loc.name as "locationName",
      e.amount_minor as "amountMinor",
      coalesce(sum(pa.amount_minor) filter (where p.status = 'posted' and p.deleted_at is null and pa.deleted_at is null), 0)::bigint as "paidAmountMinor",
      case
        when e.status = 'cancelled' then 0::bigint
        else greatest(e.amount_minor - coalesce(sum(pa.amount_minor) filter (where p.status = 'posted' and p.deleted_at is null and pa.deleted_at is null), 0), 0)::bigint
      end as "residualAmountMinor",
      e.currency_code as "currencyCode",
      e.description as "description"
    from expenses e
    inner join expense_categories ec on ec.id = e.category_id
    left join employees emp on emp.id = e.employee_id
    left join partners vendor on vendor.id = e.vendor_id
    left join locations loc on loc.id = e.location_id
    left join payment_allocations pa on pa.expense_id = e.id
    left join payments p on p.id = pa.payment_id
    where e.company_id = ${company.id}
      and e.deleted_at is null
      ${locFilter}
      and (${filters.dateFrom ?? null}::date is null or e.expense_date >= ${filters.dateFrom ?? null}::date)
      and (${filters.dateTo ?? null}::date is null or e.expense_date <= ${filters.dateTo ?? null}::date)
      and (${filters.status ?? null}::text is null or e.status::text = ${filters.status ?? null})
      and (${query} = '' or e.expense_no ilike ${`%${query}%`} or e.description ilike ${`%${query}%`} or ec.name ilike ${`%${query}%`} or vendor.display_name ilike ${`%${query}%`})
    group by e.id, ec.id, emp.id, vendor.id, loc.id
    order by e.expense_date desc, e.expense_no desc
  `);
}

export async function getPaymentAccountStatement(filters: ReportFilters): Promise<PaymentAccountStatementRow[]> {
  const company = await getDefaultCompany();
  const query = filters.query ?? "";
  const rawLocId = filters.locationId ?? await getSelectedShopId();
  const validLocId = parseValidLocationId(rawLocId);
  const locFilter = validLocId
    ? sql` and exists (
        select 1
        from payment_allocations allocations
        left join sales_orders so on so.id = allocations.sales_order_id
        left join customer_invoices ci on ci.id = allocations.customer_invoice_id
        left join sales_orders ciso on ciso.id = ci.sales_order_id
        left join deliveries cid on cid.id = ci.delivery_id
        left join purchase_orders po on po.id = allocations.purchase_order_id
        left join vendor_bills vb on vb.id = allocations.vendor_bill_id
        left join purchase_orders vbpo on vbpo.id = vb.purchase_order_id
        left join goods_receipts vbgr on vbgr.id = vb.goods_receipt_id
        left join expenses ex on ex.id = allocations.expense_id
        where allocations.payment_id = p.id
          and allocations.deleted_at is null
          and (so.source_location_id = ${validLocId}::uuid or ciso.source_location_id = ${validLocId}::uuid or cid.source_location_id = ${validLocId}::uuid or po.deliver_to_location_id = ${validLocId}::uuid or vbpo.deliver_to_location_id = ${validLocId}::uuid or vbgr.location_id = ${validLocId}::uuid or ex.location_id = ${validLocId}::uuid)
      )`
    : sql``;

  return db.execute<PaymentAccountStatementRow>(sql`
    select
      p.id as "id",
      p.payment_no as "paymentNo",
      p.payment_type::text as "paymentType",
      p.status::text as "status",
      p.payment_date::text as "paymentDate",
      partner.display_name as "partnerName",
      pm.name as "paymentMethodName",
      pa.name as "paymentAccountName",
      pa.institution_name as "institutionName",
      p.reference as "reference",
      p.amount_minor as "amountMinor",
      case when p.payment_type = 'inbound' then p.amount_minor else -p.amount_minor end::bigint as "signedAmountMinor",
      coalesce(sum(pal.amount_minor) filter (where pal.deleted_at is null), 0)::bigint as "allocatedAmountMinor",
      p.currency_code as "currencyCode"
    from payments p
    left join partners partner on partner.id = p.partner_id
    inner join payment_methods pm on pm.id = p.payment_method_id
    inner join payment_accounts pa on pa.id = p.payment_account_id
    left join payment_allocations pal on pal.payment_id = p.id and pal.deleted_at is null
    where p.company_id = ${company.id}
      and p.deleted_at is null
      ${locFilter}
      and (${filters.dateFrom ?? null}::date is null or p.payment_date >= ${filters.dateFrom ?? null}::date)
      and (${filters.dateTo ?? null}::date is null or p.payment_date <= ${filters.dateTo ?? null}::date)
      and (${filters.paymentType ?? null}::payment_type is null or p.payment_type = ${filters.paymentType ?? null}::payment_type)
      and (${filters.paymentAccountId ?? null}::uuid is null or p.payment_account_id = ${filters.paymentAccountId ?? null}::uuid)
      and (${query} = '' or p.payment_no ilike ${`%${query}%`} or p.reference ilike ${`%${query}%`} or partner.display_name ilike ${`%${query}%`} or pa.name ilike ${`%${query}%`} or pa.institution_name ilike ${`%${query}%`})
    group by p.id, partner.id, pm.id, pa.id
    order by p.payment_date desc, p.payment_no desc
  `);
}

export async function getPaymentReport(filters: ReportFilters): Promise<PaymentReportRow[]> {
  const company = await getDefaultCompany();
  const query = filters.query ?? "";
  const rawLocId = filters.locationId ?? await getSelectedShopId();
  const validLocId = parseValidLocationId(rawLocId);
  const locFilter = validLocId
    ? sql` and exists (
        select 1
        from payment_allocations allocations
        left join sales_orders so on so.id = allocations.sales_order_id
        left join customer_invoices cust_inv on cust_inv.id = allocations.customer_invoice_id
        left join sales_orders ciso on ciso.id = cust_inv.sales_order_id
        left join deliveries cid on cid.id = cust_inv.delivery_id
        left join purchase_orders po on po.id = allocations.purchase_order_id
        left join vendor_bills vbill on vbill.id = allocations.vendor_bill_id
        left join purchase_orders vbpo on vbpo.id = vbill.purchase_order_id
        left join goods_receipts vbgr on vbgr.id = vbill.goods_receipt_id
        left join expenses ex on ex.id = allocations.expense_id
        where allocations.payment_id = p.id
          and allocations.deleted_at is null
          and (so.source_location_id = ${validLocId}::uuid or ciso.source_location_id = ${validLocId}::uuid or cid.source_location_id = ${validLocId}::uuid or po.deliver_to_location_id = ${validLocId}::uuid or vbpo.deliver_to_location_id = ${validLocId}::uuid or vbgr.location_id = ${validLocId}::uuid or ex.location_id = ${validLocId}::uuid)
      )`
    : sql``;

  return db.execute<PaymentReportRow>(sql`
    select
      p.id as "id",
      p.payment_no as "paymentNo",
      p.payment_type::text as "paymentType",
      p.status::text as "status",
      p.payment_date::text as "paymentDate",
      partner.display_name as "partnerName",
      pm.name as "paymentMethodName",
      pa.name as "paymentAccountName",
      pa.institution_name as "institutionName",
      p.reference as "reference",
      p.amount_minor as "amountMinor",
      case when p.payment_type = 'inbound' then p.amount_minor else -p.amount_minor end::bigint as "signedAmountMinor",
      coalesce(sum(pal.amount_minor) filter (where pal.deleted_at is null), 0)::bigint as "allocatedAmountMinor",
      string_agg(
        distinct coalesce(ci.invoice_no, vb.bill_no, e.expense_no),
        ', '
      ) filter (where coalesce(ci.invoice_no, vb.bill_no, e.expense_no) is not null) as "sourceDocuments",
      string_agg(
        distinct case
          when ci.id is not null then 'Customer Invoice'
          when vb.id is not null then 'Vendor Bill'
          when e.id is not null then 'Expense'
          else null
        end,
        ', '
      ) filter (where ci.id is not null or vb.id is not null or e.id is not null) as "sourceTypes",
      p.currency_code as "currencyCode"
    from payments p
    left join partners partner on partner.id = p.partner_id
    inner join payment_methods pm on pm.id = p.payment_method_id
    inner join payment_accounts pa on pa.id = p.payment_account_id
    left join payment_allocations pal on pal.payment_id = p.id and pal.deleted_at is null
    left join customer_invoices ci on ci.id = pal.customer_invoice_id and ci.deleted_at is null
    left join vendor_bills vb on vb.id = pal.vendor_bill_id and vb.deleted_at is null
    left join expenses e on e.id = pal.expense_id and e.deleted_at is null
    where p.company_id = ${company.id}
      and p.deleted_at is null
      ${locFilter}
      and (${filters.dateFrom ?? null}::date is null or p.payment_date >= ${filters.dateFrom ?? null}::date)
      and (${filters.dateTo ?? null}::date is null or p.payment_date <= ${filters.dateTo ?? null}::date)
      and (${filters.status ?? null}::text is null or p.status::text = ${filters.status ?? null})
      and (${filters.paymentType ?? null}::payment_type is null or p.payment_type = ${filters.paymentType ?? null}::payment_type)
      and (${filters.paymentAccountId ?? null}::uuid is null or p.payment_account_id = ${filters.paymentAccountId ?? null}::uuid)
      and (
        ${query} = ''
        or p.payment_no ilike ${`%${query}%`}
        or p.reference ilike ${`%${query}%`}
        or partner.display_name ilike ${`%${query}%`}
        or pa.name ilike ${`%${query}%`}
        or pa.institution_name ilike ${`%${query}%`}
        or ci.invoice_no ilike ${`%${query}%`}
        or vb.bill_no ilike ${`%${query}%`}
        or e.expense_no ilike ${`%${query}%`}
      )
    group by p.id, partner.id, pm.id, pa.id
    order by p.payment_date desc, p.payment_no desc
  `);
}

export async function getStockReport(filters: ReportFilters): Promise<StockReportRow[]> {
  const company = await getDefaultCompany();
  const query = filters.query ?? "";
  const rawLocId = filters.locationId ?? await getSelectedShopId();
  const validLocId = parseValidLocationId(rawLocId);
  const locFilter = validLocId
    ? sql` and l.id = ${validLocId}::uuid`
    : sql``;

  return db.execute<StockReportRow>(sql`
    select
      p.id as "productId",
      l.id as "locationId",
      ps.id as "productSerialId",
      pl.id as "productLotId",
      p.sku as "sku",
      p.name as "productName",
      p.tracking_mode::text as "trackingMode",
      l.code as "locationCode",
      l.name as "locationName",
      ps.serial_no as "serialNo",
      pl.lot_no as "lotNo",
      sb.quantity_on_hand as "quantityOnHand",
      sb.quantity_reserved as "quantityReserved",
      sb.quantity_available as "quantityAvailable",
      sb.average_cost_minor as "averageCostMinor",
      round(cast(sb.quantity_on_hand as numeric) * sb.average_cost_minor)::bigint as "stockValueMinor",
      sb.currency_code as "currencyCode"
    from stock_balances sb
    inner join products p on p.id = sb.product_id
    inner join locations l on l.id = sb.location_id
    left join product_serials ps on ps.id = sb.product_serial_id
    left join product_lots pl on pl.id = sb.product_lot_id
    where sb.company_id = ${company.id}
      and sb.deleted_at is null
      and p.deleted_at is null
      ${locFilter}
      and (${query} = '' or p.sku ilike ${`%${query}%`} or p.name ilike ${`%${query}%`} or l.code ilike ${`%${query}%`} or ps.serial_no ilike ${`%${query}%`} or pl.lot_no ilike ${`%${query}%`})
    order by p.name asc, l.code asc, ps.serial_no asc, pl.lot_no asc
  `);
}

export async function getReceivablesReport(filters: ReportFilters): Promise<ReceivableReportRow[]> {
  const company = await getDefaultCompany();
  const query = filters.query ?? "";
  const rawLocId = filters.locationId ?? await getSelectedShopId();
  const validLocId = parseValidLocationId(rawLocId);
  const locFilter = validLocId
    ? sql` and (so.source_location_id = ${validLocId}::uuid or d.source_location_id = ${validLocId}::uuid)`
    : sql``;

  return db.execute<ReceivableReportRow>(sql`
    select
      ci.id as "id",
      ci.invoice_no as "invoiceNo",
      so.order_no as "orderNo",
      customer.display_name as "customerName",
      ci.status::text as "status",
      ci.invoice_date::text as "invoiceDate",
      ci.due_date::text as "dueDate",
      ci.total_minor as "totalMinor",
      coalesce(sum(pa.amount_minor) filter (where p.status = 'posted' and p.deleted_at is null and pa.deleted_at is null), 0)::bigint as "paidAmountMinor",
      case
        when ci.status = 'cancelled' then 0::bigint
        else greatest(ci.total_minor - coalesce(sum(pa.amount_minor) filter (where p.status = 'posted' and p.deleted_at is null and pa.deleted_at is null), 0), 0)::bigint
      end as "residualAmountMinor",
      ci.currency_code as "currencyCode"
    from customer_invoices ci
    inner join partners customer on customer.id = ci.customer_id
    left join sales_orders so on so.id = ci.sales_order_id
    left join deliveries d on d.id = ci.delivery_id
    left join payment_allocations pa on pa.customer_invoice_id = ci.id
    left join payments p on p.id = pa.payment_id
    where ci.company_id = ${company.id}
      and ci.deleted_at is null
      and ci.status <> 'cancelled'
      ${locFilter}
      and (${filters.dateFrom ?? null}::date is null or ci.invoice_date >= ${filters.dateFrom ?? null}::date)
      and (${filters.dateTo ?? null}::date is null or ci.invoice_date <= ${filters.dateTo ?? null}::date)
      and (${query} = '' or ci.invoice_no ilike ${`%${query}%`} or customer.display_name ilike ${`%${query}%`} or so.order_no ilike ${`%${query}%`})
    group by ci.id, so.id, customer.id
    having greatest(ci.total_minor - coalesce(sum(pa.amount_minor) filter (where p.status = 'posted' and p.deleted_at is null and pa.deleted_at is null), 0), 0) > 0
    order by ci.due_date asc nulls last, ci.invoice_date desc
  `);
}

export async function getPayablesReport(filters: ReportFilters): Promise<PayableReportRow[]> {
  const company = await getDefaultCompany();
  const query = filters.query ?? "";
  const rawLocId = filters.locationId ?? await getSelectedShopId();
  const validLocId = parseValidLocationId(rawLocId);
  const locFilter = validLocId
    ? sql` and (po.deliver_to_location_id = ${validLocId}::uuid or gr.location_id = ${validLocId}::uuid)`
    : sql``;

  return db.execute<PayableReportRow>(sql`
    select
      vb.id as "id",
      vb.bill_no as "billNo",
      po.order_no as "orderNo",
      supplier.display_name as "supplierName",
      vb.status::text as "status",
      vb.bill_date::text as "billDate",
      vb.due_date::text as "dueDate",
      vb.total_minor as "totalMinor",
      coalesce(sum(pa.amount_minor) filter (where p.status = 'posted' and p.deleted_at is null and pa.deleted_at is null), 0)::bigint as "paidAmountMinor",
      case
        when vb.status = 'cancelled' then 0::bigint
        else greatest(vb.total_minor - coalesce(sum(pa.amount_minor) filter (where p.status = 'posted' and p.deleted_at is null and pa.deleted_at is null), 0), 0)::bigint
      end as "residualAmountMinor",
      vb.currency_code as "currencyCode"
    from vendor_bills vb
    inner join partners supplier on supplier.id = vb.supplier_id
    left join purchase_orders po on po.id = vb.purchase_order_id
    left join goods_receipts gr on gr.id = vb.goods_receipt_id
    left join payment_allocations pa on pa.vendor_bill_id = vb.id
    left join payments p on p.id = pa.payment_id
    where vb.company_id = ${company.id}
      and vb.deleted_at is null
      and vb.status <> 'cancelled'
      ${locFilter}
      and (${filters.dateFrom ?? null}::date is null or vb.bill_date >= ${filters.dateFrom ?? null}::date)
      and (${filters.dateTo ?? null}::date is null or vb.bill_date <= ${filters.dateTo ?? null}::date)
      and (${query} = '' or vb.bill_no ilike ${`%${query}%`} or supplier.display_name ilike ${`%${query}%`} or po.order_no ilike ${`%${query}%`})
    group by vb.id, po.id, supplier.id
    having greatest(vb.total_minor - coalesce(sum(pa.amount_minor) filter (where p.status = 'posted' and p.deleted_at is null and pa.deleted_at is null), 0), 0) > 0
    order by vb.due_date asc nulls last, vb.bill_date desc
  `);
}
