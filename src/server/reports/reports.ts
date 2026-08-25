import "server-only";

import { sql } from "drizzle-orm";

import { getDefaultCompany, minorToDisplay } from "@/server/catalog/products";
import { db } from "@/server/db/client";
import type {
  DashboardPaymentAccount,
  DashboardRecentActivity,
  DashboardReport,
  ExpenseReportRow,
  PayableReportRow,
  PaymentAccountStatementRow,
  ReceivableReportRow,
  ReportFilters,
  ReportSummary,
  SalesReportRow,
  StockReportRow,
} from "@/server/reports/types";

export function displayReportMoney(value: number, currencyCode: string) {
  return `${currencyCode} ${minorToDisplay(value)}`;
}

export function normalizeReportFilters(params: {
  dateFrom?: string;
  dateTo?: string;
  q?: string;
  status?: string;
  paymentType?: string;
  paymentAccountId?: string;
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

export async function getDashboardReport(): Promise<DashboardReport> {
  const company = await getDefaultCompany();
  const today = new Date().toISOString().slice(0, 10);

  const [summary] = await db.execute<{
    salesTodayMinor: number;
    customerPaymentsTodayMinor: number;
    expensesTodayMinor: number;
    supplierPaymentsTodayMinor: number;
    receivableResidualMinor: number;
    payableResidualMinor: number;
    stockValueMinor: number;
    pendingPurchaseOrders: number;
    pendingReceipts: number;
    currencyCode: string;
  }>(sql`
    select
      coalesce((select sum(ci.total_minor) from customer_invoices ci where ci.company_id = ${company.id} and ci.deleted_at is null and ci.status = 'posted' and ci.invoice_date = ${today}::date), 0)::bigint as "salesTodayMinor",
      coalesce((select sum(p.amount_minor) from payments p where p.company_id = ${company.id} and p.deleted_at is null and p.status = 'posted' and p.payment_type = 'inbound' and p.payment_date = ${today}::date), 0)::bigint as "customerPaymentsTodayMinor",
      coalesce((select sum(e.amount_minor) from expenses e where e.company_id = ${company.id} and e.deleted_at is null and e.status <> 'cancelled' and e.expense_date = ${today}::date), 0)::bigint as "expensesTodayMinor",
      coalesce((select sum(p.amount_minor) from payments p where p.company_id = ${company.id} and p.deleted_at is null and p.status = 'posted' and p.payment_type = 'outbound' and p.payment_date = ${today}::date), 0)::bigint as "supplierPaymentsTodayMinor",
      coalesce((
        select sum(greatest(ci.total_minor - coalesce((
          select sum(pa.amount_minor)
          from payment_allocations pa
          inner join payments p on p.id = pa.payment_id
          where pa.customer_invoice_id = ci.id
            and pa.deleted_at is null
            and p.deleted_at is null
            and p.status = 'posted'
        ), 0), 0))
        from customer_invoices ci
        where ci.company_id = ${company.id}
          and ci.deleted_at is null
          and ci.status <> 'cancelled'
      ), 0)::bigint as "receivableResidualMinor",
      coalesce((
        select sum(greatest(vb.total_minor - coalesce((
          select sum(pa.amount_minor)
          from payment_allocations pa
          inner join payments p on p.id = pa.payment_id
          where pa.vendor_bill_id = vb.id
            and pa.deleted_at is null
            and p.deleted_at is null
            and p.status = 'posted'
        ), 0), 0))
        from vendor_bills vb
        where vb.company_id = ${company.id}
          and vb.deleted_at is null
          and vb.status <> 'cancelled'
      ), 0)::bigint as "payableResidualMinor",
      coalesce((select sum(cast(sb.quantity_on_hand as numeric) * sb.average_cost_minor) from stock_balances sb where sb.company_id = ${company.id} and sb.deleted_at is null), 0)::bigint as "stockValueMinor",
      coalesce((select count(*) from purchase_orders po where po.company_id = ${company.id} and po.deleted_at is null and po.status in ('draft', 'confirmed', 'partially_received')), 0)::int as "pendingPurchaseOrders",
      coalesce((select count(*) from goods_receipts gr where gr.company_id = ${company.id} and gr.deleted_at is null and gr.status <> 'posted'), 0)::int as "pendingReceipts",
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
      where ci.company_id = ${company.id} and ci.deleted_at is null
      union all
      select vb.id, vb.bill_no as "documentNo", 'Vendor bill' as "activityType", vb.bill_date::text as "activityDate", supplier.display_name as "partyName", vb.total_minor as "amountMinor", vb.currency_code as "currencyCode", '/admin/purchasing/vendor-bills/vendor_bill/' || vb.id::text as "href"
      from vendor_bills vb
      inner join partners supplier on supplier.id = vb.supplier_id
      where vb.company_id = ${company.id} and vb.deleted_at is null
      union all
      select p.id, p.payment_no as "documentNo", case when p.payment_type = 'inbound' then 'Customer payment' else 'Supplier/expense payment' end as "activityType", p.payment_date::text as "activityDate", partner.display_name as "partyName", p.amount_minor as "amountMinor", p.currency_code as "currencyCode", case when p.payment_type = 'inbound' then '/admin/sales/payments/' || p.id::text else '/admin/purchasing/payments/' || p.id::text end as "href"
      from payments p
      left join partners partner on partner.id = p.partner_id
      where p.company_id = ${company.id} and p.deleted_at is null
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
    order by p.name asc, l.code asc
    limit 8
  `);

  const resolved = summary ?? {
    salesTodayMinor: 0,
    customerPaymentsTodayMinor: 0,
    expensesTodayMinor: 0,
    supplierPaymentsTodayMinor: 0,
    receivableResidualMinor: 0,
    payableResidualMinor: 0,
    stockValueMinor: 0,
    pendingPurchaseOrders: 0,
    pendingReceipts: 0,
    currencyCode: company.baseCurrencyCode,
  };

  return {
    metrics: [
      { label: "Today Sales", value: displayReportMoney(resolved.salesTodayMinor, resolved.currencyCode), href: "/admin/reports/sales", tone: "success" },
      { label: "Customer Payments Today", value: displayReportMoney(resolved.customerPaymentsTodayMinor, resolved.currencyCode), href: "/admin/reports/payment-accounts?paymentType=inbound", tone: "success" },
      { label: "Expenses Today", value: displayReportMoney(resolved.expensesTodayMinor, resolved.currencyCode), href: "/admin/reports/expenses", tone: "warning" },
      { label: "Outbound Payments Today", value: displayReportMoney(resolved.supplierPaymentsTodayMinor, resolved.currencyCode), href: "/admin/reports/payment-accounts?paymentType=outbound", tone: "warning" },
      { label: "Receivables", value: displayReportMoney(resolved.receivableResidualMinor, resolved.currencyCode), href: "/admin/reports/receivables", tone: "danger" },
      { label: "Payables", value: displayReportMoney(resolved.payableResidualMinor, resolved.currencyCode), href: "/admin/reports/payables", tone: "warning" },
      { label: "Stock Value", value: displayReportMoney(resolved.stockValueMinor, resolved.currencyCode), href: "/admin/reports/stock" },
      { label: "Pending Purchases", value: String(resolved.pendingPurchaseOrders), href: "/admin/purchasing" },
      { label: "Pending Receipts", value: String(resolved.pendingReceipts), href: "/admin/purchasing?view=receipts" },
    ],
    paymentAccounts,
    recentActivity,
    lowStock,
  };
}

export async function getSalesReport(filters: ReportFilters): Promise<SalesReportRow[]> {
  const company = await getDefaultCompany();
  const query = filters.query ?? "";

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
      and (${filters.dateFrom ?? null}::date is null or p.payment_date >= ${filters.dateFrom ?? null}::date)
      and (${filters.dateTo ?? null}::date is null or p.payment_date <= ${filters.dateTo ?? null}::date)
      and (${filters.paymentType ?? null}::payment_type is null or p.payment_type = ${filters.paymentType ?? null}::payment_type)
      and (${filters.paymentAccountId ?? null}::uuid is null or p.payment_account_id = ${filters.paymentAccountId ?? null}::uuid)
      and (${query} = '' or p.payment_no ilike ${`%${query}%`} or p.reference ilike ${`%${query}%`} or partner.display_name ilike ${`%${query}%`} or pa.name ilike ${`%${query}%`} or pa.institution_name ilike ${`%${query}%`})
    group by p.id, partner.id, pm.id, pa.id
    order by p.payment_date desc, p.payment_no desc
  `);
}

export async function getStockReport(filters: ReportFilters): Promise<StockReportRow[]> {
  const company = await getDefaultCompany();
  const query = filters.query ?? "";

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
      and (${query} = '' or p.sku ilike ${`%${query}%`} or p.name ilike ${`%${query}%`} or l.code ilike ${`%${query}%`} or ps.serial_no ilike ${`%${query}%`} or pl.lot_no ilike ${`%${query}%`})
    order by p.name asc, l.code asc, ps.serial_no asc, pl.lot_no asc
  `);
}

export async function getReceivablesReport(filters: ReportFilters): Promise<ReceivableReportRow[]> {
  const company = await getDefaultCompany();
  const query = filters.query ?? "";

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
    left join payment_allocations pa on pa.customer_invoice_id = ci.id
    left join payments p on p.id = pa.payment_id
    where ci.company_id = ${company.id}
      and ci.deleted_at is null
      and ci.status <> 'cancelled'
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
    left join payment_allocations pa on pa.vendor_bill_id = vb.id
    left join payments p on p.id = pa.payment_id
    where vb.company_id = ${company.id}
      and vb.deleted_at is null
      and vb.status <> 'cancelled'
      and (${filters.dateFrom ?? null}::date is null or vb.bill_date >= ${filters.dateFrom ?? null}::date)
      and (${filters.dateTo ?? null}::date is null or vb.bill_date <= ${filters.dateTo ?? null}::date)
      and (${query} = '' or vb.bill_no ilike ${`%${query}%`} or supplier.display_name ilike ${`%${query}%`} or po.order_no ilike ${`%${query}%`})
    group by vb.id, po.id, supplier.id
    having greatest(vb.total_minor - coalesce(sum(pa.amount_minor) filter (where p.status = 'posted' and p.deleted_at is null and pa.deleted_at is null), 0), 0) > 0
    order by vb.due_date asc nulls last, vb.bill_date desc
  `);
}
