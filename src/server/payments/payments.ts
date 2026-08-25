import "server-only";

import { and, asc, eq, ilike, isNotNull, isNull, or, sql } from "drizzle-orm";

import { minorToDisplay } from "@/server/catalog/products";
import { getDefaultCompany } from "@/server/catalog/products";
import { db } from "@/server/db/client";
import {
  customerInvoices,
  expenses,
  paymentAccounts,
  paymentAllocations,
  paymentMethods,
  payments,
  vendorBills,
} from "@/server/db/schema";
import type {
  PaymentAccountOption,
  PaymentAccountRow,
  PaymentDetail,
  PaymentDirection,
  PaymentListRow,
  PaymentMethodOption,
  PaymentMethodRow,
  VendorBillPaymentSummary,
  CustomerInvoicePaymentSummary,
} from "@/server/payments/types";

export function displayPaymentMoney(value: number, currencyCode: string) {
  return `${currencyCode} ${minorToDisplay(value)}`;
}

export async function getPaymentMethodList(params: {
  query?: string;
  showDeleted?: boolean;
}): Promise<PaymentMethodRow[]> {
  const company = await getDefaultCompany();
  const query = params.query?.trim();
  const deletedFilter = params.showDeleted ? isNotNull(paymentMethods.deletedAt) : isNull(paymentMethods.deletedAt);
  const searchFilter = query
    ? or(
        ilike(paymentMethods.code, `%${query}%`),
        ilike(paymentMethods.name, `%${query}%`),
        ilike(paymentMethods.notes, `%${query}%`),
      )
    : undefined;

  return db
    .select({
      id: paymentMethods.id,
      code: paymentMethods.code,
      name: paymentMethods.name,
      methodType: paymentMethods.methodType,
      allowInbound: paymentMethods.allowInbound,
      allowOutbound: paymentMethods.allowOutbound,
      requiresReference: paymentMethods.requiresReference,
      isActive: paymentMethods.isActive,
      notes: paymentMethods.notes,
      deletedAt: paymentMethods.deletedAt,
    })
    .from(paymentMethods)
    .where(and(eq(paymentMethods.companyId, company.id), deletedFilter, searchFilter))
    .orderBy(asc(paymentMethods.methodType), asc(paymentMethods.name));
}

export async function getPaymentAccountList(params: {
  query?: string;
  showDeleted?: boolean;
}): Promise<PaymentAccountRow[]> {
  const company = await getDefaultCompany();
  const query = params.query?.trim();
  const deletedFilter = params.showDeleted ? isNotNull(paymentAccounts.deletedAt) : isNull(paymentAccounts.deletedAt);
  const searchFilter = query
    ? or(
        ilike(paymentAccounts.code, `%${query}%`),
        ilike(paymentAccounts.name, `%${query}%`),
        ilike(paymentAccounts.institutionName, `%${query}%`),
        ilike(paymentAccounts.accountNumber, `%${query}%`),
      )
    : undefined;

  return db
    .select({
      id: paymentAccounts.id,
      paymentMethodId: paymentAccounts.paymentMethodId,
      paymentMethodName: paymentMethods.name,
      paymentMethodType: paymentMethods.methodType,
      code: paymentAccounts.code,
      name: paymentAccounts.name,
      institutionName: paymentAccounts.institutionName,
      accountNumber: paymentAccounts.accountNumber,
      openingBalanceMinor: paymentAccounts.openingBalanceMinor,
      currencyCode: paymentAccounts.currencyCode,
      isActive: paymentAccounts.isActive,
      notes: paymentAccounts.notes,
      deletedAt: paymentAccounts.deletedAt,
    })
    .from(paymentAccounts)
    .innerJoin(paymentMethods, eq(paymentAccounts.paymentMethodId, paymentMethods.id))
    .where(and(eq(paymentAccounts.companyId, company.id), deletedFilter, searchFilter))
    .orderBy(asc(paymentMethods.name), asc(paymentAccounts.name));
}

export async function getPaymentConfigOptions() {
  const company = await getDefaultCompany();
  const methods = await db
    .select({
      id: paymentMethods.id,
      code: paymentMethods.code,
      name: paymentMethods.name,
      methodType: paymentMethods.methodType,
      requiresReference: paymentMethods.requiresReference,
    })
    .from(paymentMethods)
    .where(and(eq(paymentMethods.companyId, company.id), eq(paymentMethods.isActive, true), isNull(paymentMethods.deletedAt)))
    .orderBy(asc(paymentMethods.name));

  return { company, methods };
}

export async function getActivePaymentMethods(direction: PaymentDirection): Promise<PaymentMethodOption[]> {
  const company = await getDefaultCompany();
  const directionFilter =
    direction === "inbound"
      ? eq(paymentMethods.allowInbound, true)
      : eq(paymentMethods.allowOutbound, true);

  return db
    .select({
      id: paymentMethods.id,
      code: paymentMethods.code,
      name: paymentMethods.name,
      methodType: paymentMethods.methodType,
      requiresReference: paymentMethods.requiresReference,
    })
    .from(paymentMethods)
    .where(
      and(
        eq(paymentMethods.companyId, company.id),
        eq(paymentMethods.isActive, true),
        directionFilter,
        isNull(paymentMethods.deletedAt),
      ),
    )
    .orderBy(asc(paymentMethods.name));
}

export async function getActivePaymentAccounts(
  direction: PaymentDirection,
): Promise<PaymentAccountOption[]> {
  const company = await getDefaultCompany();
  const directionFilter =
    direction === "inbound"
      ? eq(paymentMethods.allowInbound, true)
      : eq(paymentMethods.allowOutbound, true);

  return db
    .select({
      id: paymentAccounts.id,
      code: paymentAccounts.code,
      name: paymentAccounts.name,
      paymentMethodId: paymentAccounts.paymentMethodId,
      currencyCode: paymentAccounts.currencyCode,
    })
    .from(paymentAccounts)
    .innerJoin(paymentMethods, eq(paymentAccounts.paymentMethodId, paymentMethods.id))
    .where(
      and(
        eq(paymentAccounts.companyId, company.id),
        eq(paymentAccounts.isActive, true),
        eq(paymentMethods.isActive, true),
        directionFilter,
        isNull(paymentAccounts.deletedAt),
        isNull(paymentMethods.deletedAt),
      ),
    )
    .orderBy(asc(paymentMethods.name), asc(paymentAccounts.name));
}

export async function getPaymentList(params: {
  paymentType?: PaymentDirection;
  purchaseOrderId?: string;
  vendorBillId?: string;
  expenseId?: string;
  customerInvoiceId?: string;
  salesOrderId?: string;
}): Promise<PaymentListRow[]> {
  const company = await getDefaultCompany();

  return db.execute<PaymentListRow>(sql`
    select
      p.id as "id",
      p.payment_no as "paymentNo",
      p.payment_type::text as "paymentType",
      p.status::text as "status",
      p.payment_date::text as "paymentDate",
      partner.display_name as "partnerName",
      pa.id as "paymentAccountId",
      pm.name as "paymentMethodName",
      pa.name as "paymentAccountName",
      p.amount_minor as "amountMinor",
      coalesce(sum(pal.amount_minor) filter (where pal.deleted_at is null), 0)::bigint as "allocatedAmountMinor",
      p.currency_code as "currencyCode",
      p.reference as "reference"
    from payments p
    left join partners partner on partner.id = p.partner_id
    inner join payment_methods pm on pm.id = p.payment_method_id
    inner join payment_accounts pa on pa.id = p.payment_account_id
    left join payment_allocations pal on pal.payment_id = p.id and pal.deleted_at is null
    where p.company_id = ${company.id}
      and p.deleted_at is null
      and (${params.paymentType ?? null}::payment_type is null or p.payment_type = ${params.paymentType ?? null}::payment_type)
      and (
        ${params.vendorBillId ?? null}::uuid is null
        or exists (
          select 1
          from payment_allocations target_pal
          where target_pal.payment_id = p.id
            and target_pal.vendor_bill_id = ${params.vendorBillId ?? null}::uuid
            and target_pal.deleted_at is null
        )
      )
      and (
        ${params.expenseId ?? null}::uuid is null
        or exists (
          select 1
          from payment_allocations expense_pal
          where expense_pal.payment_id = p.id
            and expense_pal.expense_id = ${params.expenseId ?? null}::uuid
            and expense_pal.deleted_at is null
        )
      )
      and (
        ${params.customerInvoiceId ?? null}::uuid is null
        or exists (
          select 1
          from payment_allocations invoice_pal
          where invoice_pal.payment_id = p.id
            and invoice_pal.customer_invoice_id = ${params.customerInvoiceId ?? null}::uuid
            and invoice_pal.deleted_at is null
        )
      )
      and (
        ${params.salesOrderId ?? null}::uuid is null
        or exists (
          select 1
          from payment_allocations so_pal
          inner join customer_invoices so_ci on so_ci.id = so_pal.customer_invoice_id
          where so_pal.payment_id = p.id
            and so_ci.sales_order_id = ${params.salesOrderId ?? null}::uuid
            and so_pal.deleted_at is null
            and so_ci.deleted_at is null
        )
      )
      and (
        ${params.purchaseOrderId ?? null}::uuid is null
        or exists (
          select 1
          from payment_allocations po_pal
          inner join vendor_bills po_vb on po_vb.id = po_pal.vendor_bill_id
          where po_pal.payment_id = p.id
            and po_vb.purchase_order_id = ${params.purchaseOrderId ?? null}::uuid
            and po_pal.deleted_at is null
            and po_vb.deleted_at is null
        )
      )
    group by p.id, partner.id, pm.id, pa.id
    order by p.payment_date desc, p.payment_no desc
  `);
}

export async function getPaymentDetail(id: string): Promise<PaymentDetail | null> {
  const company = await getDefaultCompany();

  const [payment] = await db.execute<Omit<PaymentDetail, "allocations">>(sql`
    select
      p.id as "id",
      p.payment_no as "paymentNo",
      p.payment_type::text as "paymentType",
      p.status::text as "status",
      p.payment_date::text as "paymentDate",
      partner.display_name as "partnerName",
      pa.id as "paymentAccountId",
      pm.name as "paymentMethodName",
      pa.name as "paymentAccountName",
      p.amount_minor as "amountMinor",
      coalesce(sum(pal.amount_minor) filter (where pal.deleted_at is null), 0)::bigint as "allocatedAmountMinor",
      p.currency_code as "currencyCode",
      p.reference as "reference",
      p.notes as "notes",
      p.posted_at::text as "postedAt",
      p.cancelled_at::text as "cancelledAt"
    from payments p
    left join partners partner on partner.id = p.partner_id
    inner join payment_methods pm on pm.id = p.payment_method_id
    inner join payment_accounts pa on pa.id = p.payment_account_id
    left join payment_allocations pal on pal.payment_id = p.id and pal.deleted_at is null
    where p.id = ${id}
      and p.company_id = ${company.id}
      and p.deleted_at is null
    group by p.id, partner.id, pm.id, pa.id
    limit 1
  `);

  if (!payment) {
    return null;
  }

  const allocations = await db
    .select({
      id: paymentAllocations.id,
      vendorBillId: paymentAllocations.vendorBillId,
      billNo: vendorBills.billNo,
      expenseId: paymentAllocations.expenseId,
      expenseNo: expenses.expenseNo,
      customerInvoiceId: paymentAllocations.customerInvoiceId,
      invoiceNo: customerInvoices.invoiceNo,
      amountMinor: paymentAllocations.amountMinor,
      currencyCode: payments.currencyCode,
    })
    .from(paymentAllocations)
    .innerJoin(payments, eq(paymentAllocations.paymentId, payments.id))
    .leftJoin(vendorBills, eq(paymentAllocations.vendorBillId, vendorBills.id))
    .leftJoin(expenses, eq(paymentAllocations.expenseId, expenses.id))
    .leftJoin(customerInvoices, eq(paymentAllocations.customerInvoiceId, customerInvoices.id))
    .where(and(eq(paymentAllocations.paymentId, id), isNull(paymentAllocations.deletedAt)))
    .orderBy(asc(vendorBills.billNo), asc(expenses.expenseNo), asc(customerInvoices.invoiceNo));

  return { ...payment, allocations };
}

export async function getVendorBillPaymentSummary(vendorBillId: string): Promise<VendorBillPaymentSummary> {
  const [summary] = await db.execute<{
    totalMinor: number;
    paidMinor: number;
    paymentCount: number;
  }>(sql`
    select
      vb.total_minor as "totalMinor",
      coalesce(sum(pa.amount_minor) filter (
        where p.status = 'posted'
          and p.deleted_at is null
          and pa.deleted_at is null
      ), 0)::bigint as "paidMinor",
      count(distinct p.id) filter (
        where p.deleted_at is null
          and pa.deleted_at is null
      )::int as "paymentCount"
    from vendor_bills vb
    left join payment_allocations pa on pa.vendor_bill_id = vb.id
    left join payments p on p.id = pa.payment_id
    where vb.id = ${vendorBillId}
      and vb.deleted_at is null
    group by vb.id
    limit 1
  `);

  const totalMinor = summary?.totalMinor ?? 0;
  const postedPaidMinor = summary?.paidMinor ?? 0;
  const residualAmountMinor = Math.max(totalMinor - postedPaidMinor, 0);
  const paymentStatus =
    postedPaidMinor <= 0 ? "not_paid" : residualAmountMinor <= 0 ? "paid" : "partial";

  return {
    paymentCount: summary?.paymentCount ?? 0,
    postedPaidMinor,
    residualAmountMinor,
    paymentStatus,
  };
}

export async function getCustomerInvoicePaymentSummary(customerInvoiceId: string): Promise<CustomerInvoicePaymentSummary> {
  const [summary] = await db.execute<{
    totalMinor: number;
    paidMinor: number;
    paymentCount: number;
  }>(sql`
    select
      ci.total_minor as "totalMinor",
      coalesce(sum(pa.amount_minor) filter (
        where p.status = 'posted'
          and p.deleted_at is null
          and pa.deleted_at is null
      ), 0)::bigint as "paidMinor",
      count(distinct p.id) filter (
        where p.deleted_at is null
          and pa.deleted_at is null
      )::int as "paymentCount"
    from customer_invoices ci
    left join payment_allocations pa on pa.customer_invoice_id = ci.id
    left join payments p on p.id = pa.payment_id
    where ci.id = ${customerInvoiceId}
      and ci.deleted_at is null
    group by ci.id
    limit 1
  `);

  const totalMinor = summary?.totalMinor ?? 0;
  const postedPaidMinor = summary?.paidMinor ?? 0;
  const residualAmountMinor = Math.max(totalMinor - postedPaidMinor, 0);
  const paymentStatus =
    postedPaidMinor <= 0 ? "not_paid" : residualAmountMinor <= 0 ? "paid" : "partial";

  return {
    paymentCount: summary?.paymentCount ?? 0,
    postedPaidMinor,
    residualAmountMinor,
    paymentStatus,
  };
}
