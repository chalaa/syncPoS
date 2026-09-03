import "server-only";

import { and, asc, eq, isNull, sql } from "drizzle-orm";

import { minorToDisplay, getDefaultCompany } from "@/server/catalog/products";
import { db } from "@/server/db/client";
import {
  goodsReceipts,
  locations,
  partners,
  products,
  purchaseOrders,
  salesOrders,
} from "@/server/db/schema";
import type {
  CustomerReturnDetail,
  CustomerReturnListRow,
  ReturnDetailLine,
  ReturnFormOptions,
  SupplierReturnDetail,
  SupplierReturnListRow,
} from "@/server/returns/types";

export function displayReturnMoney(value: number, currencyCode: string) {
  return `${currencyCode} ${minorToDisplay(value)}`;
}

export async function getReturnFormOptions(): Promise<ReturnFormOptions> {
  const company = await getDefaultCompany();
  const [salesOrderRows, purchaseOrderRows, receiptRows, locationRows, productRows, customerReturnableLines, supplierReturnableLines] = await Promise.all([
    db
      .select({
        id: salesOrders.id,
        code: salesOrders.orderNo,
        name: partners.displayName,
      })
      .from(salesOrders)
      .innerJoin(partners, eq(salesOrders.customerId, partners.id))
      .where(and(eq(salesOrders.companyId, company.id), isNull(salesOrders.deletedAt), sql`${salesOrders.status} in ('delivered', 'invoiced', 'partially_delivered')`))
      .orderBy(asc(salesOrders.orderNo)),
    db
      .select({
        id: purchaseOrders.id,
        code: purchaseOrders.orderNo,
        name: partners.displayName,
      })
      .from(purchaseOrders)
      .innerJoin(partners, eq(purchaseOrders.supplierId, partners.id))
      .innerJoin(goodsReceipts, eq(goodsReceipts.purchaseOrderId, purchaseOrders.id))
      .where(and(eq(purchaseOrders.companyId, company.id), isNull(purchaseOrders.deletedAt), isNull(goodsReceipts.deletedAt), eq(goodsReceipts.status, "posted")))
      .groupBy(purchaseOrders.id, partners.id)
      .orderBy(asc(purchaseOrders.orderNo)),
    db
      .select({
        id: goodsReceipts.id,
        code: goodsReceipts.receiptNo,
        name: partners.displayName,
        purchaseOrderId: goodsReceipts.purchaseOrderId,
      })
      .from(goodsReceipts)
      .innerJoin(partners, eq(goodsReceipts.supplierId, partners.id))
      .where(and(eq(goodsReceipts.companyId, company.id), isNull(goodsReceipts.deletedAt), eq(goodsReceipts.status, "posted")))
      .orderBy(asc(goodsReceipts.receiptNo)),
    db
      .select({
        id: locations.id,
        code: locations.code,
        name: locations.name,
      })
      .from(locations)
      .where(and(eq(locations.companyId, company.id), isNull(locations.deletedAt), eq(locations.isActive, true)))
      .orderBy(asc(locations.name)),
    db
      .select({
        id: products.id,
        code: products.sku,
        name: products.name,
        trackingMode: products.trackingMode,
      })
      .from(products)
      .where(and(eq(products.companyId, company.id), isNull(products.deletedAt), eq(products.isActive, true)))
      .orderBy(asc(products.name)),
    db.execute<ReturnFormOptions["customerReturnableLines"][number]>(sql`
      select
        dl.id as "id",
        d.sales_order_id as "salesOrderId",
        dl.sales_order_line_id as "salesOrderLineId",
        dl.product_id as "productId",
        pr.name as "productName",
        pr.sku as "sku",
        pr.tracking_mode::text as "trackingMode",
        dl.quantity_delivered::text as "quantityDelivered",
        coalesce(returned.quantity_returned, 0)::text as "quantityReturned",
        greatest(dl.quantity_delivered - coalesce(returned.quantity_returned, 0), 0)::text as "quantityRemaining",
        case
          when sol.quantity_ordered::numeric > 0
            then round(sol.line_total_minor::numeric / sol.quantity_ordered::numeric)::bigint
          else 0::bigint
        end as "unitRefundMinor",
        dl.currency_code as "currencyCode",
        dl.serial_no as "serialNo",
        dl.lot_no as "lotNo"
      from delivery_lines dl
      inner join deliveries d on d.id = dl.delivery_id
      inner join sales_order_lines sol on sol.id = dl.sales_order_line_id
      inner join products pr on pr.id = dl.product_id
      left join lateral (
        select sum(crl.quantity_returned)::numeric as quantity_returned
        from customer_return_lines crl
        inner join customer_returns cr on cr.id = crl.customer_return_id
        where crl.delivery_line_id = dl.id
          and crl.deleted_at is null
          and cr.deleted_at is null
          and cr.status <> 'cancelled'
      ) returned on true
      where d.company_id = ${company.id}
        and d.status = 'posted'
        and d.deleted_at is null
        and dl.deleted_at is null
        and greatest(dl.quantity_delivered - coalesce(returned.quantity_returned, 0), 0) > 0
      order by d.delivery_date desc, dl.line_no asc
    `),
    db.execute<ReturnFormOptions["supplierReturnableLines"][number]>(sql`
      select
        grl.id as "id",
        grl.goods_receipt_id as "goodsReceiptId",
        grl.purchase_order_line_id as "purchaseOrderLineId",
        grl.product_id as "productId",
        pr.name as "productName",
        pr.sku as "sku",
        pr.tracking_mode::text as "trackingMode",
        gr.location_id as "sourceLocationId",
        grl.quantity_received::text as "quantityReceived",
        coalesce(returned.quantity_returned, 0)::text as "quantityReturned",
        greatest(grl.quantity_received - coalesce(returned.quantity_returned, 0), 0)::text as "quantityRemaining",
        case
          when grl.quantity_received::numeric > 0
            then round(grl.line_total_minor::numeric / grl.quantity_received::numeric)::bigint
          else 0::bigint
        end as "unitRefundMinor",
        grl.currency_code as "currencyCode",
        grl.serial_no as "serialNo",
        grl.lot_no as "lotNo"
      from goods_receipt_lines grl
      inner join goods_receipts gr on gr.id = grl.goods_receipt_id
      inner join products pr on pr.id = grl.product_id
      left join lateral (
        select sum(srl.quantity_returned)::numeric as quantity_returned
        from supplier_return_lines srl
        inner join supplier_returns sr on sr.id = srl.supplier_return_id
        where srl.goods_receipt_line_id = grl.id
          and srl.deleted_at is null
          and sr.deleted_at is null
          and sr.status <> 'cancelled'
      ) returned on true
      where gr.company_id = ${company.id}
        and gr.status = 'posted'
        and gr.deleted_at is null
        and grl.deleted_at is null
        and greatest(grl.quantity_received - coalesce(returned.quantity_returned, 0), 0) > 0
      order by gr.receipt_date desc, grl.line_no asc
    `),
  ]);

  return {
    salesOrders: salesOrderRows,
    purchaseOrders: purchaseOrderRows,
    receipts: receiptRows,
    locations: locationRows,
    products: productRows,
    customerReturnableLines,
    supplierReturnableLines,
  };
}

export async function getCustomerReturnList(salesOrderId?: string): Promise<CustomerReturnListRow[]> {
  const company = await getDefaultCompany();
  const salesOrderFilter = salesOrderId ? sql`and cr.sales_order_id = ${salesOrderId}` : sql``;

  return db.execute<CustomerReturnListRow>(sql`
    select
      cr.id as "id",
      cr.return_no as "returnNo",
      cr.status::text as "status",
      cr.return_date::text as "returnDate",
      so.order_no as "orderNo",
      customer.display_name as "customerName",
      cr.refund_amount_minor as "refundAmountMinor",
      cr.currency_code as "currencyCode",
      count(crl.id)::int as "lineCount"
    from customer_returns cr
    inner join sales_orders so on so.id = cr.sales_order_id
    inner join partners customer on customer.id = cr.customer_id
    left join customer_return_lines crl on crl.customer_return_id = cr.id and crl.deleted_at is null
    where cr.company_id = ${company.id}
      and cr.deleted_at is null
      ${salesOrderFilter}
    group by cr.id, so.id, customer.id
    order by cr.return_date desc, cr.return_no desc
  `);
}

export async function getSupplierReturnList(purchaseOrderId?: string): Promise<SupplierReturnListRow[]> {
  const company = await getDefaultCompany();
  const purchaseOrderFilter = purchaseOrderId ? sql`and sr.purchase_order_id = ${purchaseOrderId}` : sql``;

  return db.execute<SupplierReturnListRow>(sql`
    select
      sr.id as "id",
      sr.return_no as "returnNo",
      sr.status::text as "status",
      sr.return_date::text as "returnDate",
      gr.receipt_no as "receiptNo",
      supplier.display_name as "supplierName",
      sr.refund_amount_minor as "refundAmountMinor",
      sr.currency_code as "currencyCode",
      count(srl.id)::int as "lineCount"
    from supplier_returns sr
    inner join goods_receipts gr on gr.id = sr.goods_receipt_id
    inner join partners supplier on supplier.id = sr.supplier_id
    left join supplier_return_lines srl on srl.supplier_return_id = sr.id and srl.deleted_at is null
    where sr.company_id = ${company.id}
      and sr.deleted_at is null
      ${purchaseOrderFilter}
    group by sr.id, gr.id, supplier.id
    order by sr.return_date desc, sr.return_no desc
  `);
}

export async function getCustomerReturnDetail(id: string): Promise<CustomerReturnDetail | null> {
  const company = await getDefaultCompany();
  const [record] = await db.execute<Omit<CustomerReturnDetail, "lines">>(sql`
    select
      cr.id as "id",
      cr.return_no as "returnNo",
      cr.status::text as "status",
      cr.return_date::text as "returnDate",
      so.id as "salesOrderId",
      so.order_no as "orderNo",
      cr.delivery_id as "deliveryId",
      cr.customer_invoice_id as "customerInvoiceId",
      customer.display_name as "customerName",
      loc.code as "destinationLocationCode",
      cr.refund_amount_minor as "refundAmountMinor",
      cr.currency_code as "currencyCode",
      cr.stock_movement_id as "stockMovementId",
      cr.notes as "notes",
      count(crl.id)::int as "lineCount"
    from customer_returns cr
    inner join sales_orders so on so.id = cr.sales_order_id
    inner join partners customer on customer.id = cr.customer_id
    inner join locations loc on loc.id = cr.destination_location_id
    left join customer_return_lines crl on crl.customer_return_id = cr.id and crl.deleted_at is null
    where cr.id = ${id}
      and cr.company_id = ${company.id}
      and cr.deleted_at is null
    group by cr.id, so.id, customer.id, loc.id
    limit 1
  `);

  if (!record) {
    return null;
  }

  const lines = await db.execute<ReturnDetailLine>(sql`
    select
      crl.id as "id",
      crl.line_no as "lineNo",
      pr.name as "productName",
      pr.sku as "sku",
      crl.quantity_returned::text as "quantityReturned",
      crl.condition::text as "condition",
      crl.refund_amount_minor as "refundAmountMinor",
      crl.currency_code as "currencyCode",
      crl.serial_no as "serialNo",
      crl.lot_no as "lotNo"
    from customer_return_lines crl
    inner join products pr on pr.id = crl.product_id
    where crl.customer_return_id = ${id}
      and crl.deleted_at is null
    order by crl.line_no
  `);

  return { ...record, lines };
}

export async function getSupplierReturnDetail(id: string): Promise<SupplierReturnDetail | null> {
  const company = await getDefaultCompany();
  const [record] = await db.execute<Omit<SupplierReturnDetail, "lines">>(sql`
    select
      sr.id as "id",
      sr.return_no as "returnNo",
      sr.status::text as "status",
      sr.return_date::text as "returnDate",
      po.id as "purchaseOrderId",
      gr.id as "goodsReceiptId",
      gr.receipt_no as "receiptNo",
      sr.vendor_bill_id as "vendorBillId",
      supplier.display_name as "supplierName",
      loc.code as "sourceLocationCode",
      sr.refund_amount_minor as "refundAmountMinor",
      sr.currency_code as "currencyCode",
      sr.stock_movement_id as "stockMovementId",
      sr.notes as "notes",
      count(srl.id)::int as "lineCount"
    from supplier_returns sr
    inner join goods_receipts gr on gr.id = sr.goods_receipt_id
    left join purchase_orders po on po.id = sr.purchase_order_id
    inner join partners supplier on supplier.id = sr.supplier_id
    inner join locations loc on loc.id = sr.source_location_id
    left join supplier_return_lines srl on srl.supplier_return_id = sr.id and srl.deleted_at is null
    where sr.id = ${id}
      and sr.company_id = ${company.id}
      and sr.deleted_at is null
    group by sr.id, po.id, gr.id, supplier.id, loc.id
    limit 1
  `);

  if (!record) {
    return null;
  }

  const lines = await db.execute<ReturnDetailLine>(sql`
    select
      srl.id as "id",
      srl.line_no as "lineNo",
      pr.name as "productName",
      pr.sku as "sku",
      srl.quantity_returned::text as "quantityReturned",
      srl.condition::text as "condition",
      srl.refund_amount_minor as "refundAmountMinor",
      srl.currency_code as "currencyCode",
      srl.serial_no as "serialNo",
      srl.lot_no as "lotNo"
    from supplier_return_lines srl
    inner join products pr on pr.id = srl.product_id
    where srl.supplier_return_id = ${id}
      and srl.deleted_at is null
    order by srl.line_no
  `);

  return { ...record, lines };
}
