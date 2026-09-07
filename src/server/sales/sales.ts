import "server-only";

import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";

import { getDefaultCompany, minorToDisplay } from "@/server/catalog/products";
import { db } from "@/server/db/client";
import {
  customerInvoices,
  deliveries,
  deliveryLines,
  locations,
  owners,
  partners,
  brands,
  productLots,
  productCategories,
  products,
  productSerials,
  productSaleTaxes,
  salesOrderLines,
  salesOrders,
  stockBalances,
  stockMovements,
  taxes,
  unitsOfMeasure,
} from "@/server/db/schema";
import type {
  SalesFormOptions,
  DeliveryDetail,
  DeliveryDetailLine,
  DeliveryLotOption,
  DeliverySerialOption,
  DeliveryListRow,
  CustomerInvoiceDetail,
  CustomerInvoiceDetailLine,
  CustomerInvoiceListRow,
  SalesOrderDetail,
  SalesOrderDetailLine,
  SalesOrderListRow,
  SalesTaxOption,
} from "@/server/sales/types";

export function displaySalesMoney(value: number, currencyCode: string) {
  return `${currencyCode} ${minorToDisplay(value)}`;
}

export async function getSalesFormOptions(): Promise<SalesFormOptions> {
  const company = await getDefaultCompany();
  const [customerRows, ownerRows, productRows, categoryRows, brandRows, unitRows, locationRows, taxRows] = await Promise.all([
    db
      .select({
        id: partners.id,
        code: partners.code,
        name: partners.displayName,
      })
      .from(partners)
      .where(and(eq(partners.companyId, company.id), eq(partners.isCustomer, true), isNull(partners.deletedAt)))
      .orderBy(asc(partners.displayName)),
    db
      .select({
        id: owners.id,
        code: owners.name,
        name: owners.name,
      })
      .from(owners)
      .where(and(eq(owners.companyId, company.id), isNull(owners.deletedAt)))
      .orderBy(asc(owners.name)),
    db
      .select({
        id: products.id,
        code: products.sku,
        name: products.name,
        listPriceMinor: products.listPriceMinor,
        standardCostMinor: products.standardCostMinor,
        saleTaxIds: sql<string[]>`coalesce(array_agg(${productSaleTaxes.taxId}) filter (where ${productSaleTaxes.taxId} is not null), '{}')`,
      })
      .from(products)
      .leftJoin(productSaleTaxes, eq(productSaleTaxes.productId, products.id))
      .where(and(eq(products.companyId, company.id), isNull(products.deletedAt), eq(products.isActive, true)))
      .groupBy(products.id)
      .orderBy(asc(products.name)),
    db
      .select({
        id: productCategories.id,
        code: productCategories.code,
        name: productCategories.name,
        specificationSchema: productCategories.specificationSchema,
      })
      .from(productCategories)
      .where(and(eq(productCategories.companyId, company.id), isNull(productCategories.deletedAt), eq(productCategories.isActive, true)))
      .orderBy(asc(productCategories.name)),
    db
      .select({
        id: brands.id,
        code: brands.code,
        name: brands.name,
        country: brands.country,
      })
      .from(brands)
      .where(and(eq(brands.companyId, company.id), isNull(brands.deletedAt), eq(brands.isActive, true)))
      .orderBy(asc(brands.name)),
    db
      .select({
        id: unitsOfMeasure.id,
        code: unitsOfMeasure.code,
        name: unitsOfMeasure.name,
      })
      .from(unitsOfMeasure)
      .where(and(eq(unitsOfMeasure.companyId, company.id), isNull(unitsOfMeasure.deletedAt), eq(unitsOfMeasure.isActive, true)))
      .orderBy(asc(unitsOfMeasure.code)),
    db
      .select({
        id: locations.id,
        code: locations.code,
        name: locations.name,
      })
      .from(locations)
      .where(and(eq(locations.companyId, company.id), isNull(locations.deletedAt), eq(locations.isActive, true), sql`${locations.locationType} in ('warehouse', 'display_shop')`))
      .orderBy(asc(locations.name)),
    db
      .select({
        id: taxes.id,
        code: taxes.code,
        name: taxes.name,
        computation: taxes.computation,
        rate: taxes.rate,
        amountMinor: taxes.amountMinor,
        priceIncluded: taxes.priceIncluded,
      })
      .from(taxes)
      .where(
        and(
          eq(taxes.companyId, company.id),
          isNull(taxes.deletedAt),
          eq(taxes.isActive, true),
          sql`${taxes.scope} in ('sale', 'both')`,
        ),
      )
      .orderBy(asc(taxes.name)),
  ]);

  return {
    company,
    customers: customerRows,
    owners: ownerRows,
    products: productRows,
    productCategories: categoryRows,
    productBrands: brandRows,
    productUnits: unitRows,
    locations: locationRows,
    taxes: taxRows satisfies SalesTaxOption[],
  };
}

export async function getSalesOrderList(): Promise<SalesOrderListRow[]> {
  const company = await getDefaultCompany();

  return db.execute<SalesOrderListRow>(sql`
    select
      so.id as "id",
      so.order_no as "orderNo",
      so.customer_reference as "customerReference",
      so.fs_number as "fsNumber",
      so.payment_term as "paymentTerm",
      so.owner_id as "ownerId",
      own.name as "ownerName",
      customer.display_name as "customerName",
      so.status::text as "status",
      so.order_date::text as "orderDate",
      so.valid_until::text as "validUntil",
      so.expected_delivery_date::text as "expectedDeliveryDate",
      loc.code as "sourceLocationCode",
      so.currency_code as "currencyCode",
      so.total_minor as "totalMinor",
      coalesce(pay.paid_minor, 0)::bigint as "paidMinor",
      greatest(so.total_minor - coalesce(pay.paid_minor, 0), 0)::bigint as "residualAmountMinor",
      count(sol.id)::int as "lineCount",
      coalesce(sum(sol.quantity_ordered), 0)::text as "quantityOrdered",
      coalesce(sum(sol.quantity_delivered), 0)::text as "quantityDelivered",
      coalesce(sum(sol.quantity_invoiced), 0)::text as "quantityInvoiced"
    from sales_orders so
    inner join partners customer on customer.id = so.customer_id
    left join owners own on own.id = so.owner_id
    left join locations loc on loc.id = so.source_location_id
    left join sales_order_lines sol on sol.sales_order_id = so.id and sol.deleted_at is null
    left join lateral (
      select sum(pa.amount_minor) as paid_minor
      from payment_allocations pa
      inner join payments p on p.id = pa.payment_id
      where pa.sales_order_id = so.id
        and pa.deleted_at is null
        and p.deleted_at is null
        and p.status = 'posted'
    ) pay on true
    where so.company_id = ${company.id}
      and so.deleted_at is null
    group by so.id, customer.id, own.name, loc.id, pay.paid_minor
    order by so.created_at desc
  `);
}

export async function getDeliveryList(params: {
  salesOrderId?: string;
} = {}): Promise<DeliveryListRow[]> {
  const company = await getDefaultCompany();
  const salesOrderFilter = params.salesOrderId ? sql`and d.sales_order_id = ${params.salesOrderId}` : sql``;

  return db.execute<DeliveryListRow>(sql`
    select
      d.id as "id",
      d.delivery_no as "deliveryNo",
      d.sales_order_id as "salesOrderId",
      so.order_no as "orderNo",
      customer.display_name as "customerName",
      d.status::text as "status",
      d.delivery_date::text as "deliveryDate",
      loc.code as "sourceLocationCode",
      count(dl.id)::int as "lineCount",
      coalesce(sum(dl.quantity_delivered), 0)::text as "quantityDelivered",
      coalesce(max(dl.currency_code), so.currency_code) as "currencyCode",
      coalesce(sum(dl.total_cost_minor), 0)::bigint as "totalCostMinor"
    from deliveries d
    inner join sales_orders so on so.id = d.sales_order_id
    inner join partners customer on customer.id = d.customer_id
    inner join locations loc on loc.id = d.source_location_id
    left join delivery_lines dl on dl.delivery_id = d.id and dl.deleted_at is null
    where d.company_id = ${company.id}
      and d.deleted_at is null
      ${salesOrderFilter}
    group by d.id, so.id, customer.id, loc.id
    order by d.delivery_date desc
  `);
}

export async function getDeliveryDetail(id: string): Promise<DeliveryDetail | null> {
  const company = await getDefaultCompany();

  const [delivery] = await db
    .select({
      id: deliveries.id,
      deliveryNo: deliveries.deliveryNo,
      salesOrderId: deliveries.salesOrderId,
      orderNo: salesOrders.orderNo,
      customerName: partners.displayName,
      sourceLocationId: deliveries.sourceLocationId,
      sourceLocationCode: locations.code,
      destinationLocationCode: sql<string | null>`(
        select l.code
        from stock_movements sm
        left join locations l on l.id = sm.to_location_id
        where sm.id = ${deliveries.stockMovementId}
      )`,
      status: sql<string>`${deliveries.status}::text`,
      deliveryDate: sql<string>`${deliveries.deliveryDate}::text`,
      postedAt: sql<string | null>`${deliveries.postedAt}::text`,
      stockMovementId: deliveries.stockMovementId,
      notes: deliveries.notes,
    })
    .from(deliveries)
    .innerJoin(salesOrders, eq(deliveries.salesOrderId, salesOrders.id))
    .innerJoin(partners, eq(deliveries.customerId, partners.id))
    .innerJoin(locations, eq(deliveries.sourceLocationId, locations.id))
    .where(and(eq(deliveries.id, id), eq(deliveries.companyId, company.id), isNull(deliveries.deletedAt)))
    .limit(1);

  if (!delivery) {
    return null;
  }

  const lines = await db
    .select({
      id: deliveryLines.id,
      lineNo: deliveryLines.lineNo,
      salesOrderLineId: deliveryLines.salesOrderLineId,
      productId: deliveryLines.productId,
      productName: products.name,
      sku: products.sku,
      trackingMode: products.trackingMode,
      quantityOrdered: salesOrderLines.quantityOrdered,
      quantityAlreadyDelivered: salesOrderLines.quantityDelivered,
      quantityDelivered: deliveryLines.quantityDelivered,
      unitCostMinor: deliveryLines.unitCostMinor,
      totalCostMinor: deliveryLines.totalCostMinor,
      currencyCode: deliveryLines.currencyCode,
      serialNo: deliveryLines.serialNo,
      lotNo: deliveryLines.lotNo,
    })
    .from(deliveryLines)
    .innerJoin(products, eq(deliveryLines.productId, products.id))
    .leftJoin(salesOrderLines, eq(deliveryLines.salesOrderLineId, salesOrderLines.id))
    .where(and(eq(deliveryLines.deliveryId, id), isNull(deliveryLines.deletedAt)))
    .orderBy(asc(deliveryLines.lineNo));
  const productIds = [...new Set(lines.map((line) => line.productId))];
  const [serialOptions, lotOptions] = productIds.length
    ? await Promise.all([
        db
          .select({
            id: productSerials.id,
            productId: productSerials.productId,
            serialNo: productSerials.serialNo,
            quantityAvailable: stockBalances.quantityAvailable,
          })
          .from(stockBalances)
          .innerJoin(productSerials, eq(stockBalances.productSerialId, productSerials.id))
          .where(
            and(
              eq(stockBalances.companyId, company.id),
              eq(stockBalances.locationId, delivery.sourceLocationId),
              inArray(stockBalances.productId, productIds),
              sql`cast(${stockBalances.quantityAvailable} as numeric) > 0`,
              sql`${productSerials.status} in ('available', 'reserved')`,
              eq(productSerials.currentLocationId, delivery.sourceLocationId),
              isNull(stockBalances.deletedAt),
              isNull(productSerials.deletedAt),
            ),
          )
          .orderBy(asc(productSerials.serialNo)),
        db
          .select({
            id: productLots.id,
            productId: productLots.productId,
            lotNo: productLots.lotNo,
            quantityAvailable: stockBalances.quantityAvailable,
          })
          .from(stockBalances)
          .innerJoin(productLots, eq(stockBalances.productLotId, productLots.id))
          .where(
            and(
              eq(stockBalances.companyId, company.id),
              eq(stockBalances.locationId, delivery.sourceLocationId),
              inArray(stockBalances.productId, productIds),
              sql`cast(${stockBalances.quantityAvailable} as numeric) > 0`,
              sql`${productLots.status} in ('available', 'reserved')`,
              isNull(stockBalances.deletedAt),
              isNull(productLots.deletedAt),
            ),
          )
          .orderBy(asc(productLots.lotNo)),
      ])
    : [[], []];

  return {
    ...delivery,
    lines: lines satisfies DeliveryDetailLine[],
    serialOptions: serialOptions satisfies DeliverySerialOption[],
    lotOptions: lotOptions satisfies DeliveryLotOption[],
  };
}

export async function getCustomerInvoiceList(params: {
  salesOrderId?: string;
  deliveryId?: string;
  customerInvoiceId?: string;
  customerId?: string;
} = {}): Promise<CustomerInvoiceListRow[]> {
  const company = await getDefaultCompany();
  const salesOrderFilter = params.salesOrderId ? sql`and ci.sales_order_id = ${params.salesOrderId}` : sql``;
  const deliveryFilter = params.deliveryId ? sql`and ci.delivery_id = ${params.deliveryId}` : sql``;
  const invoiceFilter = params.customerInvoiceId ? sql`and ci.id = ${params.customerInvoiceId}` : sql``;
  const customerFilter = params.customerId ? sql`and ci.customer_id = ${params.customerId}` : sql``;

  return db.execute<CustomerInvoiceListRow>(sql`
    select
      ci.id as "id",
      ci.invoice_no as "invoiceNo",
      ci.customer_reference as "customerReference",
      ci.status::text as "status",
      case
        when coalesce((
          select sum(pa.amount_minor)
          from payment_allocations pa
          inner join payments p on p.id = pa.payment_id
          where pa.customer_invoice_id = ci.id
            and pa.deleted_at is null
            and p.deleted_at is null
            and p.status = 'posted'
        ), 0) <= 0 then 'not_paid'
        when ci.total_minor - coalesce((
          select sum(pa.amount_minor)
          from payment_allocations pa
          inner join payments p on p.id = pa.payment_id
          where pa.customer_invoice_id = ci.id
            and pa.deleted_at is null
            and p.deleted_at is null
            and p.status = 'posted'
        ), 0) <= 0 then 'paid'
        else 'partial'
      end as "paymentStatus",
      ci.invoice_date::text as "invoiceDate",
      ci.due_date::text as "dueDate",
      so.id as "salesOrderId",
      so.order_no as "orderNo",
      d.id as "deliveryId",
      d.delivery_no as "deliveryNo",
      customer.display_name as "customerName",
      string_agg(distinct pr.name, ', ' order by pr.name) as "productSummary",
      ci.currency_code as "currencyCode",
      ci.untaxed_amount_minor as "untaxedAmountMinor",
      ci.tax_amount_minor as "taxAmountMinor",
      ci.total_minor as "totalMinor",
      case
        when ci.status = 'cancelled' then 0::bigint
        else greatest(ci.total_minor - coalesce((
          select sum(pa.amount_minor)
          from payment_allocations pa
          inner join payments p on p.id = pa.payment_id
          where pa.customer_invoice_id = ci.id
            and pa.deleted_at is null
            and p.deleted_at is null
            and p.status = 'posted'
        ), 0), 0)::bigint
      end as "residualAmountMinor",
      count(distinct cil.id)::int as "lineCount"
    from customer_invoices ci
    inner join partners customer on customer.id = ci.customer_id
    left join sales_orders so on so.id = ci.sales_order_id
    left join deliveries d on d.id = ci.delivery_id
    left join customer_invoice_lines cil on cil.customer_invoice_id = ci.id and cil.deleted_at is null
    left join products pr on pr.id = cil.product_id
    where ci.company_id = ${company.id}
      and ci.deleted_at is null
      ${salesOrderFilter}
      ${deliveryFilter}
      ${invoiceFilter}
      ${customerFilter}
    group by ci.id, so.id, d.id, customer.id
    order by ci.invoice_date desc, ci.invoice_no desc
  `);
}

export async function getCustomerInvoiceDetail(id: string): Promise<CustomerInvoiceDetail | null> {
  const company = await getDefaultCompany();

  const [invoice] = await db.execute<Omit<CustomerInvoiceDetail, "lines">>(sql`
    select
      ci.id as "id",
      ci.invoice_no as "invoiceNo",
      ci.customer_reference as "customerReference",
      ci.status::text as "status",
      case
        when coalesce((
          select sum(pa.amount_minor)
          from payment_allocations pa
          inner join payments p on p.id = pa.payment_id
          where pa.customer_invoice_id = ci.id
            and pa.deleted_at is null
            and p.deleted_at is null
            and p.status = 'posted'
        ), 0) <= 0 then 'not_paid'
        when ci.total_minor - coalesce((
          select sum(pa.amount_minor)
          from payment_allocations pa
          inner join payments p on p.id = pa.payment_id
          where pa.customer_invoice_id = ci.id
            and pa.deleted_at is null
            and p.deleted_at is null
            and p.status = 'posted'
        ), 0) <= 0 then 'paid'
        else 'partial'
      end as "paymentStatus",
      ci.invoice_date::text as "invoiceDate",
      ci.due_date::text as "dueDate",
      ci.untaxed_amount_minor as "untaxedAmountMinor",
      ci.tax_amount_minor as "taxAmountMinor",
      ci.total_minor as "totalMinor",
      case
        when ci.status = 'cancelled' then 0::bigint
        else greatest(ci.total_minor - coalesce((
          select sum(pa.amount_minor)
          from payment_allocations pa
          inner join payments p on p.id = pa.payment_id
          where pa.customer_invoice_id = ci.id
            and pa.deleted_at is null
            and p.deleted_at is null
            and p.status = 'posted'
        ), 0), 0)::bigint
      end as "residualAmountMinor",
      ci.currency_code as "currencyCode",
      so.id as "salesOrderId",
      so.order_no as "orderNo",
      d.id as "deliveryId",
      d.delivery_no as "deliveryNo",
      customer.display_name as "customerName",
      (
        select count(distinct p.id)::int
        from payment_allocations pa
        inner join payments p on p.id = pa.payment_id
        where pa.customer_invoice_id = ci.id
          and pa.deleted_at is null
          and p.deleted_at is null
      ) as "paymentCount",
      ci.notes as "notes"
    from customer_invoices ci
    inner join partners customer on customer.id = ci.customer_id
    left join sales_orders so on so.id = ci.sales_order_id
    left join deliveries d on d.id = ci.delivery_id
    where ci.id = ${id}
      and ci.company_id = ${company.id}
      and ci.deleted_at is null
    limit 1
  `);

  if (!invoice) {
    return null;
  }

  const lines = await db.execute<CustomerInvoiceDetailLine>(sql`
    select
      cil.id as "id",
      cil.line_no as "lineNo",
      pr.name as "productName",
      pr.sku as "sku",
      cil.description as "description",
      cil.quantity::text as "quantity",
      cil.unit_price_minor as "unitPriceMinor",
      cil.discount_minor as "discountMinor",
      cil.tax_amount_minor as "taxAmountMinor",
      string_agg(distinct t.name, ', ' order by t.name) as "taxNames",
      cil.line_total_minor as "lineTotalMinor",
      cil.currency_code as "currencyCode"
    from customer_invoice_lines cil
    left join products pr on pr.id = cil.product_id
    left join customer_invoice_line_taxes cilt on cilt.customer_invoice_line_id = cil.id
    left join taxes t on t.id = cilt.tax_id
    where cil.customer_invoice_id = ${id}
      and cil.deleted_at is null
    group by cil.id, pr.id
    order by cil.line_no
  `);

  return { ...invoice, lines };
}

export async function getSalesOrderDetail(id: string): Promise<SalesOrderDetail | null> {
  const company = await getDefaultCompany();

  const [order] = await db
    .select({
      id: salesOrders.id,
      orderNo: salesOrders.orderNo,
      customerId: salesOrders.customerId,
      customerName: partners.displayName,
      ownerId: salesOrders.ownerId,
      ownerName: owners.name,
      sourceLocationId: salesOrders.sourceLocationId,
      customerReference: salesOrders.customerReference,
      fsNumber: salesOrders.fsNumber,
      paymentTerm: salesOrders.paymentTerm,
      status: sql<string>`${salesOrders.status}::text`,
      orderDate: sql<string>`${salesOrders.orderDate}::text`,
      validUntil: sql<string | null>`${salesOrders.validUntil}::text`,
      expectedDeliveryDate: sql<string | null>`${salesOrders.expectedDeliveryDate}::text`,
      currencyCode: salesOrders.currencyCode,
      subtotalMinor: salesOrders.subtotalMinor,
      taxAmountMinor: salesOrders.taxAmountMinor,
      totalMinor: salesOrders.totalMinor,
      paidMinor: sql<number>`
        coalesce((
          select sum(pa.amount_minor)
          from payment_allocations pa
          inner join payments p on p.id = pa.payment_id
          where pa.sales_order_id = ${salesOrders.id}
            and pa.deleted_at is null
            and p.deleted_at is null
            and p.status = 'posted'
        ), 0)::bigint
      `,
      residualAmountMinor: sql<number>`
        greatest(
          ${salesOrders.totalMinor} - coalesce((
            select sum(pa.amount_minor)
            from payment_allocations pa
            inner join payments p on p.id = pa.payment_id
            where pa.sales_order_id = ${salesOrders.id}
              and pa.deleted_at is null
              and p.deleted_at is null
              and p.status = 'posted'
          ), 0),
          0
        )::bigint
      `,
      reserveOnConfirm: salesOrders.reserveOnConfirm,
      notes: salesOrders.notes,
    })
    .from(salesOrders)
    .innerJoin(partners, eq(salesOrders.customerId, partners.id))
    .leftJoin(owners, eq(salesOrders.ownerId, owners.id))
    .where(and(eq(salesOrders.id, id), eq(salesOrders.companyId, company.id), isNull(salesOrders.deletedAt)))
    .limit(1);

  if (!order) {
    return null;
  }

  const [lineRows, [deliveryCount], [invoiceCount], [paymentCount], [returnCount]] = await Promise.all([
    db.execute<SalesOrderDetailLine>(sql`
      select
        sol.id as "id",
        sol.line_no as "lineNo",
        sol.owner_id as "ownerId",
        own.name as "ownerName",
        sol.product_id as "productId",
        product.name as "productName",
        product.sku as "sku",
        product.tracking_mode::text as "trackingMode",
        sol.quantity_ordered::text as "quantityOrdered",
        sol.quantity_reserved::text as "quantityReserved",
        sol.quantity_delivered::text as "quantityDelivered",
        sol.quantity_invoiced::text as "quantityInvoiced",
        sol.unit_price_minor as "unitPriceMinor",
        sol.discount_minor as "discountMinor",
        sol.tax_amount_minor as "taxAmountMinor",
        sol.line_total_minor as "lineTotalMinor",
        sol.currency_code as "currencyCode",
        coalesce(array_agg(solt.tax_id) filter (where solt.tax_id is not null), '{}') as "taxIds",
        string_agg(t.name, ', ' order by t.name) as "taxNames"
      from sales_order_lines sol
      inner join products product on product.id = sol.product_id
      left join owners own on own.id = sol.owner_id
      left join sales_order_line_taxes solt on solt.sales_order_line_id = sol.id
      left join taxes t on t.id = solt.tax_id
      where sol.sales_order_id = ${id}
        and sol.deleted_at is null
      group by sol.id, product.id, own.id
      order by sol.line_no
    `),
    db.select({ count: sql<number>`count(*)::int` }).from(deliveries).where(and(eq(deliveries.salesOrderId, id), isNull(deliveries.deletedAt))),
    db.select({ count: sql<number>`count(*)::int` }).from(customerInvoices).where(and(eq(customerInvoices.salesOrderId, id), isNull(customerInvoices.deletedAt))),
    db.execute<{ count: number }>(sql`
      select count(distinct p.id)::int as "count"
      from payments p
      inner join payment_allocations pa on pa.payment_id = p.id
      where pa.sales_order_id = ${id}
        and p.deleted_at is null
        and pa.deleted_at is null
    `),
    db.select({ count: sql<number>`count(*)::int` }).from(stockMovements).where(and(eq(stockMovements.sourceType, "sales_return"), eq(stockMovements.sourceId, id), isNull(stockMovements.deletedAt))),
  ]);
  const productIds = [...new Set(lineRows.map((line) => line.productId))];
  const [serialOptions, lotOptions] = order.sourceLocationId && productIds.length
    ? await Promise.all([
        db
          .select({
            id: productSerials.id,
            productId: productSerials.productId,
            serialNo: productSerials.serialNo,
            quantityAvailable: stockBalances.quantityAvailable,
          })
          .from(stockBalances)
          .innerJoin(productSerials, eq(stockBalances.productSerialId, productSerials.id))
          .where(
            and(
              eq(stockBalances.companyId, company.id),
              eq(stockBalances.locationId, order.sourceLocationId),
              inArray(stockBalances.productId, productIds),
              sql`cast(${stockBalances.quantityAvailable} as numeric) > 0`,
              sql`${productSerials.status} in ('available', 'reserved')`,
              eq(productSerials.currentLocationId, order.sourceLocationId),
              isNull(stockBalances.deletedAt),
              isNull(productSerials.deletedAt),
            ),
          )
          .orderBy(asc(productSerials.serialNo)),
        db
          .select({
            id: productLots.id,
            productId: productLots.productId,
            lotNo: productLots.lotNo,
            quantityAvailable: stockBalances.quantityAvailable,
          })
          .from(stockBalances)
          .innerJoin(productLots, eq(stockBalances.productLotId, productLots.id))
          .where(
            and(
              eq(stockBalances.companyId, company.id),
              eq(stockBalances.locationId, order.sourceLocationId),
              inArray(stockBalances.productId, productIds),
              sql`cast(${stockBalances.quantityAvailable} as numeric) > 0`,
              sql`${productLots.status} in ('available', 'reserved')`,
              isNull(stockBalances.deletedAt),
              isNull(productLots.deletedAt),
            ),
          )
          .orderBy(asc(productLots.lotNo)),
      ])
    : [[], []];

  return {
    ...order,
    deliveryCount: deliveryCount?.count ?? 0,
    invoiceCount: invoiceCount?.count ?? 0,
    paymentCount: paymentCount?.count ?? 0,
    returnCount: returnCount?.count ?? 0,
    lines: lineRows,
    serialOptions: serialOptions satisfies DeliverySerialOption[],
    lotOptions: lotOptions satisfies DeliveryLotOption[],
  };
}
