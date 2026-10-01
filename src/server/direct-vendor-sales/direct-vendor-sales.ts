import "server-only";

import { and, asc, eq, isNull, sql } from "drizzle-orm";

import { minorToDisplay } from "@/lib/catalog-utils";
import { getDefaultCompany } from "@/server/catalog/products";
import { db } from "@/server/db/client";
import {
  brands,
  partners,
  paymentAccounts,
  paymentMethods,
  productCategories,
  products,
  unitsOfMeasure,
} from "@/server/db/schema";
import { getOwnerOptions } from "@/server/owners/owners";
import type {
  DirectVendorSaleDetail,
  DirectVendorSaleDetailLine,
  DirectVendorSaleFormOptions,
  DirectVendorSaleListRow,
  DirectVendorSalePaymentOption,
  DirectVendorSaleProductOption,
} from "@/server/direct-vendor-sales/types";

export function displayDirectVendorSaleMoney(value: number, currencyCode: string) {
  return `${currencyCode} ${minorToDisplay(value)}`;
}

export async function getDirectVendorSaleFormOptions(): Promise<DirectVendorSaleFormOptions> {
  const company = await getDefaultCompany();

  const [customers, vendors, ownerRows, productRows, categoryRows, brandRows, unitRows, inboundPaymentRows, outboundPaymentRows] = await Promise.all([
    db
      .select({ id: partners.id, code: partners.code, name: partners.displayName })
      .from(partners)
      .where(and(eq(partners.companyId, company.id), eq(partners.isCustomer, true), isNull(partners.deletedAt)))
      .orderBy(asc(partners.displayName)),
    db
      .select({ id: partners.id, code: partners.code, name: partners.displayName })
      .from(partners)
      .where(and(eq(partners.companyId, company.id), eq(partners.isSupplier, true), isNull(partners.deletedAt)))
      .orderBy(asc(partners.displayName)),
    getOwnerOptions(),
    db
      .select({
        id: products.id,
        code: products.sku,
        sku: products.sku,
        name: products.name,
        listPriceMinor: products.listPriceMinor,
        standardCostMinor: products.standardCostMinor,
      })
      .from(products)
      .where(and(eq(products.companyId, company.id), eq(products.isActive, true), isNull(products.deletedAt)))
      .orderBy(asc(products.name)),
    db
      .select({
        id: productCategories.id,
        code: productCategories.code,
        name: productCategories.name,
        specificationSchema: productCategories.specificationSchema,
      })
      .from(productCategories)
      .where(and(eq(productCategories.companyId, company.id), eq(productCategories.isActive, true), isNull(productCategories.deletedAt)))
      .orderBy(asc(productCategories.name)),
    db
      .select({ id: brands.id, code: brands.code, name: brands.name, country: brands.country })
      .from(brands)
      .where(and(eq(brands.companyId, company.id), eq(brands.isActive, true), isNull(brands.deletedAt)))
      .orderBy(asc(brands.name)),
    db
      .select({ id: unitsOfMeasure.id, code: unitsOfMeasure.code, name: unitsOfMeasure.name })
      .from(unitsOfMeasure)
      .where(and(eq(unitsOfMeasure.companyId, company.id), eq(unitsOfMeasure.isActive, true), isNull(unitsOfMeasure.deletedAt)))
      .orderBy(asc(unitsOfMeasure.code)),
    getPaymentAccounts("inbound"),
    getPaymentAccounts("outbound"),
  ]);

  return {
    company,
    customers,
    vendors,
    owners: ownerRows,
    products: productRows satisfies DirectVendorSaleProductOption[],
    productCategories: categoryRows,
    productBrands: brandRows,
    productUnits: unitRows,
    inboundPaymentAccounts: inboundPaymentRows,
    outboundPaymentAccounts: outboundPaymentRows,
  };
}

async function getPaymentAccounts(direction: "inbound" | "outbound"): Promise<DirectVendorSalePaymentOption[]> {
  const company = await getDefaultCompany();
  const directionFilter = direction === "inbound" ? eq(paymentMethods.allowInbound, true) : eq(paymentMethods.allowOutbound, true);

  return db
    .select({
      id: paymentAccounts.id,
      code: paymentAccounts.code,
      name: paymentAccounts.name,
      paymentMethodId: paymentAccounts.paymentMethodId,
      paymentMethodName: paymentMethods.name,
      requiresReference: paymentMethods.requiresReference,
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

export async function getDirectVendorSaleList(params?: { query?: string; status?: string }): Promise<DirectVendorSaleListRow[]> {
  const company = await getDefaultCompany();
  const query = params?.query?.trim() ?? "";
  const status = params?.status?.trim() ?? "";

  const statusFilter = status ? sql`and dvs.status = ${status}::direct_vendor_sale_status` : sql``;
  const searchFilter = query
    ? sql`and (dvs.sale_no ilike ${`%${query}%`} or customer.display_name ilike ${`%${query}%`} or vendor.display_name ilike ${`%${query}%`})`
    : sql``;

  const rows = await db.execute<DirectVendorSaleListRow>(sql`
    select
      dvs.id as "id",
      dvs.sale_no as "saleNo",
      customer.display_name as "customerName",
      vendor.display_name as "vendorName",
      own.name as "ownerName",
      dvs.status::text as "status",
      dvs.sale_date::text as "saleDate",
      dvs.currency_code as "currencyCode",
      dvs.customer_total_minor as "customerTotalMinor",
      dvs.vendor_cost_total_minor as "vendorCostTotalMinor",
      dvs.margin_minor as "marginMinor",
      dvs.customer_payment_term::text as "customerPaymentTerm",
      dvs.vendor_payment_term::text as "vendorPaymentTerm",
      customer_pm.name as "customerPaymentName",
      vendor_pm.name as "vendorPaymentName",
      count(dvsl.id)::int as "lineCount",
      coalesce(sum(dvsl.quantity), 0)::text as "quantity"
    from direct_vendor_sales dvs
    inner join partners customer on customer.id = dvs.customer_id
    inner join partners vendor on vendor.id = dvs.vendor_id
    left join owners own on own.id = dvs.owner_id
    left join payment_methods customer_pm on customer_pm.id = dvs.customer_payment_method_id
    left join payment_methods vendor_pm on vendor_pm.id = dvs.vendor_payment_method_id
    left join direct_vendor_sale_lines dvsl on dvsl.direct_vendor_sale_id = dvs.id and dvsl.deleted_at is null
    where dvs.company_id = ${company.id}
      and dvs.deleted_at is null
      ${statusFilter}
      ${searchFilter}
    group by dvs.id, customer.id, vendor.id, own.id, customer_pm.id, vendor_pm.id
    order by dvs.created_at desc
  `);

  return rows.map((row) => ({
    ...row,
    customerTotalMinor: Number(row.customerTotalMinor),
    vendorCostTotalMinor: Number(row.vendorCostTotalMinor),
    marginMinor: Number(row.marginMinor),
  }));
}

export async function getDirectVendorSaleDetail(id: string): Promise<DirectVendorSaleDetail | null> {
  const company = await getDefaultCompany();
  const [sale] = await db.execute<Omit<DirectVendorSaleDetail, "lines">>(sql`
    select
      dvs.id as "id",
      dvs.sale_no as "saleNo",
      dvs.customer_id as "customerId",
      customer.display_name as "customerName",
      dvs.vendor_id as "vendorId",
      vendor.display_name as "vendorName",
      own.name as "ownerName",
      dvs.sale_date::text as "saleDate",
      dvs.status::text as "status",
      dvs.currency_code as "currencyCode",
      dvs.customer_payment_term::text as "customerPaymentTerm",
      dvs.vendor_payment_term::text as "vendorPaymentTerm",
      customer_pm.name as "customerPaymentName",
      dvs.customer_payment_reference as "customerPaymentReference",
      vendor_pm.name as "vendorPaymentName",
      dvs.vendor_payment_reference as "vendorPaymentReference",
      dvs.subtotal_minor as "subtotalMinor",
      dvs.tax_amount_minor as "taxAmountMinor",
      dvs.customer_total_minor as "customerTotalMinor",
      dvs.vendor_cost_total_minor as "vendorCostTotalMinor",
      dvs.margin_minor as "marginMinor",
      dvs.customer_paid_minor as "customerPaidMinor",
      dvs.vendor_paid_minor as "vendorPaidMinor",
      (
        select count(distinct p.id)::int
        from payment_allocations pa
        inner join payments p on p.id = pa.payment_id
        where pa.customer_direct_vendor_sale_id = dvs.id
          and pa.deleted_at is null
          and p.deleted_at is null
      ) as "customerPaymentCount",
      (
        select count(distinct p.id)::int
        from payment_allocations pa
        inner join payments p on p.id = pa.payment_id
        where pa.vendor_direct_vendor_sale_id = dvs.id
          and pa.deleted_at is null
          and p.deleted_at is null
      ) as "vendorPaymentCount",
      dvs.notes as "notes",
      dvs.posted_at::text as "postedAt",
      dvs.cancelled_at::text as "cancelledAt"
    from direct_vendor_sales dvs
    inner join partners customer on customer.id = dvs.customer_id
    inner join partners vendor on vendor.id = dvs.vendor_id
    left join owners own on own.id = dvs.owner_id
    left join payment_methods customer_pm on customer_pm.id = dvs.customer_payment_method_id
    left join payment_methods vendor_pm on vendor_pm.id = dvs.vendor_payment_method_id
    where dvs.id = ${id}
      and dvs.company_id = ${company.id}
      and dvs.deleted_at is null
    limit 1
  `);

  if (!sale) {
    return null;
  }

  const lines = await db.execute<DirectVendorSaleDetailLine>(sql`
    select
      dvsl.id as "id",
      dvsl.line_no as "lineNo",
      p.name as "productName",
      p.sku as "sku",
      dvsl.description as "description",
      uom.code as "unitCode",
      dvsl.quantity::text as "quantity",
      dvsl.vendor_unit_cost_minor as "vendorUnitCostMinor",
      dvsl.customer_unit_price_minor as "customerUnitPriceMinor",
      dvsl.discount_minor as "discountMinor",
      dvsl.tax_amount_minor as "taxAmountMinor",
      dvsl.vendor_line_total_minor as "vendorLineTotalMinor",
      dvsl.customer_line_total_minor as "customerLineTotalMinor",
      dvsl.line_margin_minor as "lineMarginMinor",
      dvsl.currency_code as "currencyCode"
    from direct_vendor_sale_lines dvsl
    inner join products p on p.id = dvsl.product_id
    inner join units_of_measure uom on uom.id = dvsl.unit_id
    where dvsl.direct_vendor_sale_id = ${sale.id}
      and dvsl.deleted_at is null
    order by dvsl.line_no
  `);

  return {
    ...sale,
    subtotalMinor: Number(sale.subtotalMinor),
    taxAmountMinor: Number(sale.taxAmountMinor),
    customerTotalMinor: Number(sale.customerTotalMinor),
    vendorCostTotalMinor: Number(sale.vendorCostTotalMinor),
    marginMinor: Number(sale.marginMinor),
    customerPaidMinor: Number(sale.customerPaidMinor),
    vendorPaidMinor: Number(sale.vendorPaidMinor),
    customerPaymentCount: Number(sale.customerPaymentCount),
    vendorPaymentCount: Number(sale.vendorPaymentCount),
    lines: lines.map((line) => ({
      ...line,
      vendorUnitCostMinor: Number(line.vendorUnitCostMinor),
      customerUnitPriceMinor: Number(line.customerUnitPriceMinor),
      discountMinor: Number(line.discountMinor),
      taxAmountMinor: Number(line.taxAmountMinor),
      vendorLineTotalMinor: Number(line.vendorLineTotalMinor),
      customerLineTotalMinor: Number(line.customerLineTotalMinor),
      lineMarginMinor: Number(line.lineMarginMinor),
    })),
  };
}
