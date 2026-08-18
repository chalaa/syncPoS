import "server-only";

import { and, asc, eq, ilike, isNotNull, isNull, or, sql } from "drizzle-orm";

import { getDefaultCompany, minorToDisplay } from "@/server/catalog/products";
import { db } from "@/server/db/client";
import {
  attachments,
  employees,
  expenseCategories,
  locations,
  partners,
} from "@/server/db/schema";
import type {
  ExpenseCategoryRow,
  ExpenseDetail,
  ExpenseFormOptions,
  ExpenseListRow,
} from "@/server/expenses/types";

export function displayExpenseMoney(value: number, currencyCode: string) {
  return `${currencyCode} ${minorToDisplay(value)}`;
}

export async function getExpenseCategoryList(params: {
  query?: string;
  showDeleted?: boolean;
}): Promise<ExpenseCategoryRow[]> {
  const company = await getDefaultCompany();
  const query = params.query?.trim();
  const deletedFilter = params.showDeleted ? isNotNull(expenseCategories.deletedAt) : isNull(expenseCategories.deletedAt);
  const searchFilter = query
    ? or(
        ilike(expenseCategories.code, `%${query}%`),
        ilike(expenseCategories.name, `%${query}%`),
        ilike(expenseCategories.description, `%${query}%`),
      )
    : undefined;

  return db
    .select({
      id: expenseCategories.id,
      code: expenseCategories.code,
      name: expenseCategories.name,
      description: expenseCategories.description,
      isActive: expenseCategories.isActive,
      deletedAt: expenseCategories.deletedAt,
    })
    .from(expenseCategories)
    .where(and(eq(expenseCategories.companyId, company.id), deletedFilter, searchFilter))
    .orderBy(asc(expenseCategories.name));
}

export async function getExpenseList(params: {
  query?: string;
  showCancelled?: boolean;
}): Promise<ExpenseListRow[]> {
  const company = await getDefaultCompany();
  const query = params.query?.trim();
  const statusFilter = params.showCancelled ? undefined : sql`e.status <> 'cancelled'`;
  const searchFilter = query
    ? sql`(e.expense_no ilike ${`%${query}%`} or e.description ilike ${`%${query}%`} or ec.name ilike ${`%${query}%`})`
    : undefined;

  return db.execute<ExpenseListRow>(sql`
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
      coalesce(sum(pa.amount_minor) filter (
        where p.status = 'posted'
          and p.deleted_at is null
          and pa.deleted_at is null
      ), 0)::bigint as "paidAmountMinor",
      case
        when e.status = 'cancelled' then 0::bigint
        else greatest(e.amount_minor - coalesce(sum(pa.amount_minor) filter (
          where p.status = 'posted'
            and p.deleted_at is null
            and pa.deleted_at is null
        ), 0), 0)::bigint
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
      ${statusFilter ? sql`and ${statusFilter}` : sql``}
      ${searchFilter ? sql`and ${searchFilter}` : sql``}
    group by e.id, ec.id, emp.id, vendor.id, loc.id
    order by e.expense_date desc, e.expense_no desc
  `);
}

export async function getExpenseDetail(id: string): Promise<ExpenseDetail | null> {
  const company = await getDefaultCompany();
  const [expense] = await db.execute<Omit<ExpenseDetail, "attachments">>(sql`
    select
      e.id as "id",
      e.expense_no as "expenseNo",
      e.status::text as "status",
      e.payment_status::text as "paymentStatus",
      e.expense_date::text as "expenseDate",
      e.category_id as "categoryId",
      ec.name as "categoryName",
      e.employee_id as "employeeId",
      emp.full_name as "employeeName",
      e.vendor_id as "vendorId",
      vendor.display_name as "vendorName",
      e.location_id as "locationId",
      loc.name as "locationName",
      e.amount_minor as "amountMinor",
      coalesce(sum(pa.amount_minor) filter (
        where p.status = 'posted'
          and p.deleted_at is null
          and pa.deleted_at is null
      ), 0)::bigint as "paidAmountMinor",
      case
        when e.status = 'cancelled' then 0::bigint
        else greatest(e.amount_minor - coalesce(sum(pa.amount_minor) filter (
          where p.status = 'posted'
            and p.deleted_at is null
            and pa.deleted_at is null
        ), 0), 0)::bigint
      end as "residualAmountMinor",
      e.currency_code as "currencyCode",
      e.description as "description",
      count(distinct p.id) filter (
        where p.deleted_at is null
          and pa.deleted_at is null
      )::int as "paymentCount"
    from expenses e
    inner join expense_categories ec on ec.id = e.category_id
    left join employees emp on emp.id = e.employee_id
    left join partners vendor on vendor.id = e.vendor_id
    left join locations loc on loc.id = e.location_id
    left join payment_allocations pa on pa.expense_id = e.id
    left join payments p on p.id = pa.payment_id
    where e.id = ${id}
      and e.company_id = ${company.id}
      and e.deleted_at is null
    group by e.id, ec.id, emp.id, vendor.id, loc.id
    limit 1
  `);

  if (!expense) {
    return null;
  }

  const rows = await db
    .select({
      id: attachments.id,
      fileName: attachments.fileName,
      mimeType: attachments.mimeType,
      sizeBytes: attachments.sizeBytes,
      objectKey: attachments.objectKey,
    })
    .from(attachments)
    .where(and(eq(attachments.companyId, company.id), eq(attachments.entityType, "expense"), eq(attachments.entityId, id), isNull(attachments.deletedAt)))
    .orderBy(asc(attachments.fileName));

  return { ...expense, attachments: rows };
}

export async function getExpenseFormOptions(): Promise<ExpenseFormOptions> {
  const company = await getDefaultCompany();
  const [categoryRows, employeeRows, vendorRows, locationRows] = await Promise.all([
    db
      .select({ id: expenseCategories.id, code: expenseCategories.code, name: expenseCategories.name })
      .from(expenseCategories)
      .where(and(eq(expenseCategories.companyId, company.id), eq(expenseCategories.isActive, true), isNull(expenseCategories.deletedAt)))
      .orderBy(asc(expenseCategories.name)),
    db
      .select({ id: employees.id, code: employees.employeeNo, name: employees.fullName })
      .from(employees)
      .where(and(eq(employees.companyId, company.id), isNull(employees.deletedAt)))
      .orderBy(asc(employees.fullName)),
    db
      .select({ id: partners.id, code: partners.code, name: partners.displayName })
      .from(partners)
      .where(and(eq(partners.companyId, company.id), eq(partners.isSupplier, true), isNull(partners.deletedAt)))
      .orderBy(asc(partners.displayName)),
    db
      .select({ id: locations.id, code: locations.code, name: locations.name })
      .from(locations)
      .where(and(eq(locations.companyId, company.id), isNull(locations.deletedAt)))
      .orderBy(asc(locations.name)),
  ]);

  return {
    categories: categoryRows.map((row) => ({ ...row, code: row.code ?? "" })),
    employees: employeeRows.map((row) => ({ ...row, code: row.code ?? "" })),
    vendors: vendorRows,
    locations: locationRows,
  };
}
