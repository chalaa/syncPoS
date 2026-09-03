import "server-only";

import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";

import { getDefaultCompany, minorToDisplay } from "@/server/catalog/products";
import { db } from "@/server/db/client";
import {
  goodsReceipts,
  goodsReceiptLines,
  landedCostAllocations,
  landedCosts,
  locations,
  productLots,
  productSerials,
  partners,
  products,
  productPurchaseTaxes,
  purchaseOrderLines,
  purchaseOrders,
  supplierBillPlaceholders,
  supplierReturns,
  taxes,
  vendorBills,
} from "@/server/db/schema";
import { stockSelectableLocationTypeOptions } from "@/server/inventory/location-types";
import type {
  PurchaseOrderDetail,
  PurchaseOrderDetailLine,
  PurchaseFormOption,
  PurchaseLandedCostDetail,
  PurchaseLandedCostFormOptions,
  PurchaseLandedCostFormReceiptLine,
  PurchaseLandedCostListRow,
  PurchaseOrderListRow,
  PurchaseOrderReceiptDocument,
  PurchaseOrderReceiptDocumentLine,
  PurchaseOrderReceiptLine,
  PurchaseReceiptListRow,
  PurchaseReceiptDetail,
  PurchaseTaxOption,
  PurchaseOrderVendorBillDocument,
  PurchaseOrderVendorBillDocumentLine,
  PurchaseVendorBillDetail,
  PurchaseVendorBillListRow,
} from "@/server/purchasing/types";

export function displayPurchaseMoney(value: number, currencyCode: string) {
  return `${currencyCode} ${minorToDisplay(value)}`;
}

export async function getPurchaseFormOptions() {
  const company = await getDefaultCompany();
  const [supplierRows, productRows, locationRows, taxRows] = await Promise.all([
    db
      .select({
        id: partners.id,
        code: partners.code,
        name: partners.displayName,
      })
      .from(partners)
      .where(
        and(
          eq(partners.companyId, company.id),
          eq(partners.isSupplier, true),
          isNull(partners.deletedAt),
        ),
      )
      .orderBy(asc(partners.displayName)),
    db
      .select({
        id: products.id,
        code: products.sku,
        name: products.name,
        listPriceMinor: products.listPriceMinor,
        standardCostMinor: products.standardCostMinor,
        purchaseTaxIds: sql<string[]>`coalesce(array_agg(${productPurchaseTaxes.taxId}) filter (where ${productPurchaseTaxes.taxId} is not null), '{}')`,
      })
      .from(products)
      .leftJoin(productPurchaseTaxes, eq(productPurchaseTaxes.productId, products.id))
      .where(and(eq(products.companyId, company.id), isNull(products.deletedAt), eq(products.isActive, true)))
      .groupBy(products.id)
      .orderBy(asc(products.name)),
    db
      .select({
        id: locations.id,
        code: locations.code,
        name: locations.name,
      })
      .from(locations)
      .where(
        and(
          eq(locations.companyId, company.id),
          isNull(locations.deletedAt),
          eq(locations.isActive, true),
          inArray(locations.locationType, [...stockSelectableLocationTypeOptions]),
        ),
      )
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
          sql`${taxes.scope} in ('purchase', 'both')`,
        ),
      )
      .orderBy(asc(taxes.name)),
  ]);

  return {
    company,
    suppliers: supplierRows satisfies PurchaseFormOption[],
    products: productRows satisfies PurchaseFormOption[],
    locations: locationRows satisfies PurchaseFormOption[],
    taxes: taxRows satisfies PurchaseTaxOption[],
  };
}

export async function getPurchaseOrderList(): Promise<PurchaseOrderListRow[]> {
  const company = await getDefaultCompany();

  const rows = await db.execute<PurchaseOrderListRow>(sql`
    select
      po.id as "id",
      po.order_no as "orderNo",
      po.vendor_reference as "vendorReference",
      po.payment_term as "paymentTerm",
      p.display_name as "supplierName",
      po.status as "status",
      po.order_date::text as "orderDate",
      po.payment_due_date::text as "paymentDueDate",
      po.deliver_to_location_id as "deliverToLocationId",
      l.code as "deliverToLocationCode",
      po.currency_code as "currencyCode",
      po.total_minor as "totalMinor",
      coalesce(pay.paid_minor, 0)::bigint as "paidMinor",
      greatest(po.total_minor - coalesce(pay.paid_minor, 0), 0)::bigint as "residualAmountMinor",
      count(pol.id)::int as "lineCount",
      coalesce(sum(pol.quantity_ordered), 0)::text as "quantityOrdered",
      coalesce(sum(pol.quantity_received), 0)::text as "quantityReceived"
    from purchase_orders po
    inner join partners p on p.id = po.supplier_id
    left join locations l on l.id = po.deliver_to_location_id
    left join purchase_order_lines pol on pol.purchase_order_id = po.id and pol.deleted_at is null
    left join lateral (
      select sum(pa.amount_minor) as paid_minor
      from payment_allocations pa
      inner join payments pay on pay.id = pa.payment_id
      where pa.purchase_order_id = po.id
        and pa.deleted_at is null
        and pay.deleted_at is null
        and pay.status = 'posted'
    ) pay on true
    where po.company_id = ${company.id}
      and po.deleted_at is null
    group by po.id, p.display_name, l.code, pay.paid_minor
    order by po.created_at desc
  `);

  return rows;
}

export async function getPurchaseReceiptList(purchaseOrderId?: string): Promise<PurchaseReceiptListRow[]> {
  const company = await getDefaultCompany();

  const rows = await db.execute<PurchaseReceiptListRow>(sql`
    select
      gr.id as "id",
      gr.receipt_no as "receiptNo",
      gr.status as "status",
      gr.receipt_date::text as "receiptDate",
      po.id as "purchaseOrderId",
      po.order_no as "orderNo",
      p.display_name as "supplierName",
      l.code as "locationCode",
      gr.supplier_invoice_no as "supplierInvoiceNo",
      po.currency_code as "currencyCode",
      count(grl.id)::int as "lineCount",
      coalesce(sum(grl.quantity_received), 0)::text as "quantityReceived",
      coalesce(sum(grl.line_total_minor), 0)::bigint as "totalMinor"
    from goods_receipts gr
    inner join purchase_orders po on po.id = gr.purchase_order_id
    inner join partners p on p.id = gr.supplier_id
    left join locations l on l.id = gr.location_id
    left join goods_receipt_lines grl on grl.goods_receipt_id = gr.id and grl.deleted_at is null
    where gr.company_id = ${company.id}
      and gr.deleted_at is null
      and (${purchaseOrderId ?? null}::uuid is null or gr.purchase_order_id = ${purchaseOrderId ?? null}::uuid)
    group by gr.id, po.id, p.display_name, l.code
    order by gr.receipt_date desc
  `);

  return rows;
}

export async function getPurchaseVendorBillList(
  params: string | { purchaseOrderId?: string; supplierId?: string } = {},
): Promise<PurchaseVendorBillListRow[]> {
  const company = await getDefaultCompany();
  const purchaseOrderId = typeof params === "string" ? params : params.purchaseOrderId;
  const supplierId = typeof params === "string" ? undefined : params.supplierId;

  const rows = await db.execute<PurchaseVendorBillListRow>(sql`
    select
      vb.id as "id",
      vb.bill_no as "billNo",
      vb.vendor_reference as "vendorReference",
      vb.status::text as "status",
      vb.bill_date::text as "billDate",
      vb.due_date::text as "dueDate",
      po.id as "purchaseOrderId",
      po.order_no as "orderNo",
      partner.display_name as "supplierName",
      string_agg(distinct pr.name, ', ' order by pr.name) as "productSummary",
      'vendor_bill' as "source",
      case
        when coalesce(sum(pa.amount_minor) filter (where pay.status = 'posted' and pay.deleted_at is null and pa.deleted_at is null), 0) <= 0 then 'not_paid'
        when vb.total_minor - coalesce(sum(pa.amount_minor) filter (where pay.status = 'posted' and pay.deleted_at is null and pa.deleted_at is null), 0) <= 0 then 'paid'
        else 'partial'
      end as "paymentStatus",
      vb.currency_code as "currencyCode",
      vb.untaxed_amount_minor as "untaxedAmountMinor",
      vb.tax_amount_minor as "taxAmountMinor",
      vb.total_minor as "totalMinor",
      case
        when vb.status = 'cancelled' then 0::bigint
        else greatest(vb.total_minor - coalesce(sum(pa.amount_minor) filter (where pay.status = 'posted' and pay.deleted_at is null and pa.deleted_at is null), 0), 0)::bigint
      end as "residualAmountMinor",
      count(distinct vbl.id)::int as "lineCount"
    from vendor_bills vb
    inner join partners partner on partner.id = vb.supplier_id
    left join purchase_orders po on po.id = vb.purchase_order_id
    left join vendor_bill_lines vbl on vbl.vendor_bill_id = vb.id and vbl.deleted_at is null
    left join products pr on pr.id = vbl.product_id
    left join payment_allocations pa on pa.vendor_bill_id = vb.id and pa.deleted_at is null
    left join payments pay on pay.id = pa.payment_id and pay.deleted_at is null
    where vb.company_id = ${company.id}
      and vb.deleted_at is null
      and (${purchaseOrderId ?? null}::uuid is null or vb.purchase_order_id = ${purchaseOrderId ?? null}::uuid)
      and (${supplierId ?? null}::uuid is null or vb.supplier_id = ${supplierId ?? null}::uuid)
    group by vb.id, po.id, partner.display_name
    union all
    select
      sbp.id as "id",
      sbp.bill_no as "billNo",
      null as "vendorReference",
      sbp.status::text as "status",
      sbp.bill_date::text as "billDate",
      null as "dueDate",
      po.id as "purchaseOrderId",
      po.order_no as "orderNo",
      partner.display_name as "supplierName",
      null as "productSummary",
      'placeholder' as "source",
      'not_paid' as "paymentStatus",
      sbp.currency_code as "currencyCode",
      sbp.amount_minor as "untaxedAmountMinor",
      0::bigint as "taxAmountMinor",
      sbp.amount_minor as "totalMinor",
      case when sbp.status = 'cancelled' then 0::bigint else sbp.amount_minor end as "residualAmountMinor",
      0::int as "lineCount"
    from supplier_bill_placeholders sbp
    inner join partners partner on partner.id = sbp.supplier_id
    left join purchase_orders po on po.id = sbp.purchase_order_id
    where sbp.company_id = ${company.id}
      and sbp.deleted_at is null
      and (${purchaseOrderId ?? null}::uuid is null or sbp.purchase_order_id = ${purchaseOrderId ?? null}::uuid)
      and (${supplierId ?? null}::uuid is null or sbp.supplier_id = ${supplierId ?? null}::uuid)
    order by "billDate" desc
  `);

  return rows;
}

export async function getPurchaseReceiptDetail(id: string): Promise<PurchaseReceiptDetail | null> {
  const company = await getDefaultCompany();

  const [receipt] = await db
    .select({
      id: goodsReceipts.id,
      receiptNo: goodsReceipts.receiptNo,
      status: goodsReceipts.status,
      receiptDate: sql<string>`${goodsReceipts.receiptDate}::text`,
      purchaseOrderId: purchaseOrders.id,
      orderNo: purchaseOrders.orderNo,
      supplierName: partners.displayName,
      supplierInvoiceNo: goodsReceipts.supplierInvoiceNo,
      sourceLocationCode: sql<string | null>`(
        select l.code
        from stock_movements sm
        left join locations l on l.id = sm.from_location_id
        where sm.id = ${goodsReceipts.stockMovementId}
      )`,
      locationCode: locations.code,
      currencyCode: purchaseOrders.currencyCode,
      totalMinor: sql<number>`coalesce(sum(${goodsReceiptLines.lineTotalMinor}), 0)::bigint`,
    })
    .from(goodsReceipts)
    .innerJoin(purchaseOrders, eq(goodsReceipts.purchaseOrderId, purchaseOrders.id))
    .innerJoin(partners, eq(goodsReceipts.supplierId, partners.id))
    .leftJoin(locations, eq(goodsReceipts.locationId, locations.id))
    .leftJoin(goodsReceiptLines, and(eq(goodsReceiptLines.goodsReceiptId, goodsReceipts.id), isNull(goodsReceiptLines.deletedAt)))
    .where(and(eq(goodsReceipts.id, id), eq(goodsReceipts.companyId, company.id), isNull(goodsReceipts.deletedAt)))
    .groupBy(goodsReceipts.id, purchaseOrders.id, partners.id, locations.id)
    .limit(1);

  if (!receipt) {
    return null;
  }

  const [[existingVendorBill], [landedCostCount]] = await Promise.all([
    db
      .select({ id: vendorBills.id })
      .from(vendorBills)
      .where(and(eq(vendorBills.goodsReceiptId, id), eq(vendorBills.companyId, company.id), isNull(vendorBills.deletedAt)))
      .limit(1),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(landedCosts)
      .where(and(eq(landedCosts.goodsReceiptId, id), eq(landedCosts.companyId, company.id), isNull(landedCosts.deletedAt))),
  ]);

  const lines = await db
    .select({
      id: goodsReceiptLines.id,
      receiptId: goodsReceiptLines.goodsReceiptId,
      lineNo: goodsReceiptLines.lineNo,
      productName: products.name,
      sku: products.sku,
      quantityReceived: goodsReceiptLines.quantityReceived,
      unitCostMinor: goodsReceiptLines.unitCostMinor,
      landedUnitCostMinor: goodsReceiptLines.landedUnitCostMinor,
      lineTotalMinor: goodsReceiptLines.lineTotalMinor,
      currencyCode: goodsReceiptLines.currencyCode,
      serialNo: productSerials.serialNo,
      lotNo: productLots.lotNo,
    })
    .from(goodsReceiptLines)
    .innerJoin(products, eq(goodsReceiptLines.productId, products.id))
    .leftJoin(productSerials, eq(goodsReceiptLines.productSerialId, productSerials.id))
    .leftJoin(productLots, eq(goodsReceiptLines.productLotId, productLots.id))
    .where(and(eq(goodsReceiptLines.goodsReceiptId, id), isNull(goodsReceiptLines.deletedAt)))
    .orderBy(asc(goodsReceiptLines.lineNo));

  return { ...receipt, existingVendorBillId: existingVendorBill?.id ?? null, landedCostCount: landedCostCount?.count ?? 0, lines };
}

export async function getPurchaseVendorBillDetail(
  source: "vendor_bill" | "placeholder",
  id: string,
): Promise<PurchaseVendorBillDetail | null> {
  const company = await getDefaultCompany();

  if (source === "placeholder") {
    const [bill] = await db
      .select({
        id: supplierBillPlaceholders.id,
        billNo: supplierBillPlaceholders.billNo,
        vendorReference: sql<string | null>`null`,
        status: sql<string>`${supplierBillPlaceholders.status}::text`,
        billDate: sql<string>`${supplierBillPlaceholders.billDate}::text`,
        dueDate: sql<string | null>`null`,
        untaxedAmountMinor: supplierBillPlaceholders.amountMinor,
        taxAmountMinor: sql<number>`0::bigint`,
        totalMinor: supplierBillPlaceholders.amountMinor,
        residualAmountMinor: sql<number>`case when ${supplierBillPlaceholders.status} = 'cancelled' then 0::bigint else ${supplierBillPlaceholders.amountMinor} end`,
        paymentStatus: sql<string>`'not_paid'`,
        currencyCode: supplierBillPlaceholders.currencyCode,
        purchaseOrderId: purchaseOrders.id,
        orderNo: purchaseOrders.orderNo,
        goodsReceiptId: sql<string | null>`null`,
        receiptNo: sql<string | null>`null`,
        supplierName: partners.displayName,
        paymentCount: sql<number>`0::int`,
      })
      .from(supplierBillPlaceholders)
      .innerJoin(partners, eq(supplierBillPlaceholders.supplierId, partners.id))
      .leftJoin(purchaseOrders, eq(supplierBillPlaceholders.purchaseOrderId, purchaseOrders.id))
      .where(and(eq(supplierBillPlaceholders.id, id), eq(supplierBillPlaceholders.companyId, company.id), isNull(supplierBillPlaceholders.deletedAt)))
      .limit(1);

    return bill ? { ...bill, source, lines: [] } : null;
  }

  const [bill] = await db.execute<Omit<PurchaseVendorBillDetail, "source" | "lines">>(sql`
    select
      vb.id as "id",
      vb.bill_no as "billNo",
      vb.vendor_reference as "vendorReference",
      vb.status::text as "status",
      vb.bill_date::text as "billDate",
      vb.due_date::text as "dueDate",
      vb.untaxed_amount_minor as "untaxedAmountMinor",
      vb.tax_amount_minor as "taxAmountMinor",
      vb.total_minor as "totalMinor",
      case
        when vb.status = 'cancelled' then 0::bigint
        else greatest(vb.total_minor - coalesce((
          select sum(pa.amount_minor)
          from payment_allocations pa
          inner join payments p on p.id = pa.payment_id
          where pa.vendor_bill_id = vb.id
            and pa.deleted_at is null
            and p.deleted_at is null
            and p.status = 'posted'
        ), 0), 0)::bigint
      end as "residualAmountMinor",
      case
        when coalesce((
          select sum(pa.amount_minor)
          from payment_allocations pa
          inner join payments p on p.id = pa.payment_id
          where pa.vendor_bill_id = vb.id
            and pa.deleted_at is null
            and p.deleted_at is null
            and p.status = 'posted'
        ), 0) <= 0 then 'not_paid'
        when vb.total_minor - coalesce((
          select sum(pa.amount_minor)
          from payment_allocations pa
          inner join payments p on p.id = pa.payment_id
          where pa.vendor_bill_id = vb.id
            and pa.deleted_at is null
            and p.deleted_at is null
            and p.status = 'posted'
        ), 0) <= 0 then 'paid'
        else 'partial'
      end as "paymentStatus",
      vb.currency_code as "currencyCode",
      po.id as "purchaseOrderId",
      po.order_no as "orderNo",
      gr.id as "goodsReceiptId",
      gr.receipt_no as "receiptNo",
      partner.display_name as "supplierName",
      (
        select count(distinct p.id)::int
        from payment_allocations pa
        inner join payments p on p.id = pa.payment_id
        where pa.vendor_bill_id = vb.id
          and pa.deleted_at is null
          and p.deleted_at is null
      ) as "paymentCount"
    from vendor_bills vb
    inner join partners partner on partner.id = vb.supplier_id
    left join purchase_orders po on po.id = vb.purchase_order_id
    left join goods_receipts gr on gr.id = vb.goods_receipt_id
    where vb.id = ${id}
      and vb.company_id = ${company.id}
      and vb.deleted_at is null
    limit 1
  `);

  if (!bill) {
    return null;
  }

  const lines = await db
    .execute<PurchaseOrderVendorBillDocumentLine>(sql`
      select
        vbl.id as "id",
        vbl.vendor_bill_id as "billId",
        vbl.line_no as "lineNo",
        pr.name as "productName",
        pr.sku as "sku",
        vbl.description as "description",
        vbl.quantity::text as "quantity",
        vbl.unit_price_minor as "unitPriceMinor",
        vbl.tax_amount_minor as "taxAmountMinor",
        string_agg(distinct t.name, ', ' order by t.name) as "taxNames",
        vbl.total_minor as "totalMinor",
        vbl.currency_code as "currencyCode"
      from vendor_bill_lines vbl
      left join products pr on pr.id = vbl.product_id
      left join vendor_bill_line_taxes vblt on vblt.vendor_bill_line_id = vbl.id
      left join taxes t on t.id = vblt.tax_id
      where vbl.vendor_bill_id = ${id}
        and vbl.deleted_at is null
      group by vbl.id, pr.id
      order by vbl.line_no
    `);

  return { ...bill, source, lines };
}

export async function getPurchaseLandedCostList(purchaseOrderId?: string): Promise<PurchaseLandedCostListRow[]> {
  const company = await getDefaultCompany();

  return db
    .select({
      id: landedCosts.id,
      costNo: landedCosts.costNo,
      costType: sql<string>`${landedCosts.costType}::text`,
      status: sql<string>`${landedCosts.status}::text`,
      allocationMethod: sql<string>`${landedCosts.allocationMethod}::text`,
      purchaseOrderId: purchaseOrders.id,
      orderNo: purchaseOrders.orderNo,
      receiptNo: goodsReceipts.receiptNo,
      vendorName: partners.displayName,
      amountMinor: landedCosts.amountMinor,
      currencyCode: landedCosts.currencyCode,
      allocationCount: sql<number>`count(${landedCostAllocations.id})::int`,
    })
    .from(landedCosts)
    .leftJoin(purchaseOrders, eq(landedCosts.purchaseOrderId, purchaseOrders.id))
    .leftJoin(goodsReceipts, eq(landedCosts.goodsReceiptId, goodsReceipts.id))
    .leftJoin(partners, eq(landedCosts.vendorId, partners.id))
    .leftJoin(
      landedCostAllocations,
      and(
        eq(landedCostAllocations.landedCostId, landedCosts.id),
        isNull(landedCostAllocations.deletedAt),
      ),
    )
    .where(
      and(
        eq(landedCosts.companyId, company.id),
        isNull(landedCosts.deletedAt),
        purchaseOrderId ? eq(landedCosts.purchaseOrderId, purchaseOrderId) : undefined,
      ),
    )
    .groupBy(landedCosts.id, purchaseOrders.id, goodsReceipts.id, partners.id)
    .orderBy(asc(landedCosts.costNo));
}

export async function getPurchaseLandedCostFormOptions(): Promise<PurchaseLandedCostFormOptions> {
  const company = await getDefaultCompany();

  const [receiptRows, receiptLineRows, vendorRows] = await Promise.all([
    db
      .select({
        id: goodsReceipts.id,
        receiptNo: goodsReceipts.receiptNo,
        orderNo: purchaseOrders.orderNo,
        purchaseOrderId: purchaseOrders.id,
        supplierName: partners.displayName,
        currencyCode: purchaseOrders.currencyCode,
      })
      .from(goodsReceipts)
      .innerJoin(purchaseOrders, eq(goodsReceipts.purchaseOrderId, purchaseOrders.id))
      .innerJoin(partners, eq(goodsReceipts.supplierId, partners.id))
      .where(and(eq(goodsReceipts.companyId, company.id), eq(goodsReceipts.status, "posted"), isNull(goodsReceipts.deletedAt)))
      .orderBy(asc(goodsReceipts.receiptDate)),
    db
      .select({
        id: goodsReceiptLines.id,
        receiptId: goodsReceiptLines.goodsReceiptId,
        lineNo: goodsReceiptLines.lineNo,
        productName: products.name,
        sku: products.sku,
        quantityReceived: goodsReceiptLines.quantityReceived,
        lineTotalMinor: goodsReceiptLines.lineTotalMinor,
        currencyCode: goodsReceiptLines.currencyCode,
      })
      .from(goodsReceiptLines)
      .innerJoin(goodsReceipts, eq(goodsReceiptLines.goodsReceiptId, goodsReceipts.id))
      .innerJoin(products, eq(goodsReceiptLines.productId, products.id))
      .where(and(eq(goodsReceipts.companyId, company.id), eq(goodsReceipts.status, "posted"), isNull(goodsReceipts.deletedAt), isNull(goodsReceiptLines.deletedAt)))
      .orderBy(asc(goodsReceiptLines.lineNo)),
    db
      .select({
        id: partners.id,
        code: partners.code,
        name: partners.displayName,
      })
      .from(partners)
      .where(and(eq(partners.companyId, company.id), eq(partners.isSupplier, true), isNull(partners.deletedAt)))
      .orderBy(asc(partners.displayName)),
  ]);

  const linesByReceiptId = new Map<string, PurchaseLandedCostFormReceiptLine[]>();
  for (const line of receiptLineRows) {
    const current = linesByReceiptId.get(line.receiptId) ?? [];
    current.push({
      id: line.id,
      lineNo: line.lineNo,
      productName: line.productName,
      sku: line.sku,
      quantityReceived: line.quantityReceived,
      lineTotalMinor: line.lineTotalMinor,
      currencyCode: line.currencyCode,
    });
    linesByReceiptId.set(line.receiptId, current);
  }

  return {
    receipts: receiptRows.map((receipt) => ({
      ...receipt,
      lines: linesByReceiptId.get(receipt.id) ?? [],
    })),
    vendors: vendorRows,
  };
}

export async function getPurchaseLandedCostDetail(id: string): Promise<PurchaseLandedCostDetail | null> {
  const company = await getDefaultCompany();

  const [cost] = await db
    .select({
      id: landedCosts.id,
      costNo: landedCosts.costNo,
      costType: sql<string>`${landedCosts.costType}::text`,
      status: sql<string>`${landedCosts.status}::text`,
      allocationMethod: sql<string>`${landedCosts.allocationMethod}::text`,
      purchaseOrderId: purchaseOrders.id,
      orderNo: purchaseOrders.orderNo,
      goodsReceiptId: goodsReceipts.id,
      receiptNo: goodsReceipts.receiptNo,
      vendorId: landedCosts.vendorId,
      vendorName: partners.displayName,
      amountMinor: landedCosts.amountMinor,
      currencyCode: landedCosts.currencyCode,
      notes: landedCosts.notes,
    })
    .from(landedCosts)
    .leftJoin(purchaseOrders, eq(landedCosts.purchaseOrderId, purchaseOrders.id))
    .leftJoin(goodsReceipts, eq(landedCosts.goodsReceiptId, goodsReceipts.id))
    .leftJoin(partners, eq(landedCosts.vendorId, partners.id))
    .where(and(eq(landedCosts.id, id), eq(landedCosts.companyId, company.id), isNull(landedCosts.deletedAt)))
    .limit(1);

  if (!cost) {
    return null;
  }

  const allocations = await db
    .select({
      id: landedCostAllocations.id,
      goodsReceiptLineId: goodsReceiptLines.id,
      lineNo: goodsReceiptLines.lineNo,
      productName: products.name,
      sku: products.sku,
      quantityReceived: goodsReceiptLines.quantityReceived,
      unitCostMinor: goodsReceiptLines.unitCostMinor,
      landedUnitCostMinor: goodsReceiptLines.landedUnitCostMinor,
      allocatedAmountMinor: landedCostAllocations.allocatedAmountMinor,
      allocationBasis: sql<string | null>`${landedCostAllocations.allocationBasis}::text`,
      currencyCode: goodsReceiptLines.currencyCode,
    })
    .from(landedCostAllocations)
    .innerJoin(goodsReceiptLines, eq(landedCostAllocations.goodsReceiptLineId, goodsReceiptLines.id))
    .innerJoin(products, eq(goodsReceiptLines.productId, products.id))
    .where(and(eq(landedCostAllocations.landedCostId, id), isNull(landedCostAllocations.deletedAt), isNull(goodsReceiptLines.deletedAt)))
    .orderBy(asc(goodsReceiptLines.lineNo));

  return { ...cost, allocations };
}

export async function getPurchaseOrderDetail(id: string): Promise<PurchaseOrderDetail | null> {
  const company = await getDefaultCompany();

  const [order] = await db
    .select({
      id: purchaseOrders.id,
      orderNo: purchaseOrders.orderNo,
      supplierId: purchaseOrders.supplierId,
      supplierName: partners.displayName,
      deliverToLocationId: purchaseOrders.deliverToLocationId,
      vendorReference: purchaseOrders.vendorReference,
      paymentTerm: purchaseOrders.paymentTerm,
      status: purchaseOrders.status,
      orderDate: sql<string>`${purchaseOrders.orderDate}::text`,
      paymentDueDate: sql<string | null>`${purchaseOrders.paymentDueDate}::text`,
      currencyCode: purchaseOrders.currencyCode,
      subtotalMinor: purchaseOrders.subtotalMinor,
      taxAmountMinor: purchaseOrders.taxAmountMinor,
      totalMinor: purchaseOrders.totalMinor,
      paidMinor: sql<number>`
        coalesce((
          select sum(pa.amount_minor)
          from payment_allocations pa
          inner join payments p on p.id = pa.payment_id
          where pa.purchase_order_id = ${purchaseOrders.id}
            and pa.deleted_at is null
            and p.deleted_at is null
            and p.status = 'posted'
        ), 0)::bigint
      `,
      residualAmountMinor: sql<number>`
        greatest(
          ${purchaseOrders.totalMinor} - coalesce((
            select sum(pa.amount_minor)
            from payment_allocations pa
            inner join payments p on p.id = pa.payment_id
            where pa.purchase_order_id = ${purchaseOrders.id}
              and pa.deleted_at is null
              and p.deleted_at is null
              and p.status = 'posted'
          ), 0),
          0
        )::bigint
      `,
      notes: purchaseOrders.notes,
    })
    .from(purchaseOrders)
    .innerJoin(partners, eq(purchaseOrders.supplierId, partners.id))
    .where(and(eq(purchaseOrders.id, id), eq(purchaseOrders.companyId, company.id), isNull(purchaseOrders.deletedAt)))
    .limit(1);

  if (!order) {
    return null;
  }

  const [
    lineRows,
    receiptRows,
    receiptLineRows,
    vendorBillRows,
    vendorBillLineRows,
    placeholderBillRows,
    receiptCountRows,
    placeholderBillCountRows,
    vendorBillCountRows,
    landedCostCountRows,
    paymentCountRows,
    returnCountRows,
  ] = await Promise.all([
    db.execute<PurchaseOrderDetailLine>(sql`
      select
        pol.id as "id",
        pol.line_no as "lineNo",
        pol.product_id as "productId",
        pr.name as "productName",
        pr.sku as "sku",
        pr.tracking_mode as "trackingMode",
        pol.quantity_ordered::text as "quantityOrdered",
        pol.quantity_received::text as "quantityReceived",
        pol.unit_cost_minor as "unitCostMinor",
        pol.tax_amount_minor as "taxAmountMinor",
        pol.line_total_minor as "lineTotalMinor",
        pol.currency_code as "currencyCode",
        coalesce(array_agg(polt.tax_id) filter (where polt.tax_id is not null), '{}') as "taxIds",
        string_agg(t.name, ', ' order by t.name) as "taxNames"
      from purchase_order_lines pol
      inner join products pr on pr.id = pol.product_id
      left join purchase_order_line_taxes polt on polt.purchase_order_line_id = pol.id
      left join taxes t on t.id = polt.tax_id
      where pol.purchase_order_id = ${id}
        and pol.deleted_at is null
      group by pol.id, pr.id
      order by pol.line_no
    `),
    db
      .select({
        id: goodsReceipts.id,
        receiptNo: goodsReceipts.receiptNo,
        status: goodsReceipts.status,
        receiptDate: sql<string>`${goodsReceipts.receiptDate}::text`,
        locationCode: locations.code,
      })
      .from(goodsReceipts)
      .leftJoin(locations, eq(goodsReceipts.locationId, locations.id))
      .where(and(eq(goodsReceipts.purchaseOrderId, id), isNull(goodsReceipts.deletedAt)))
      .orderBy(asc(goodsReceipts.receiptDate)),
    db
      .select({
        id: goodsReceiptLines.id,
        receiptId: goodsReceiptLines.goodsReceiptId,
        lineNo: goodsReceiptLines.lineNo,
        productName: products.name,
        sku: products.sku,
        quantityReceived: goodsReceiptLines.quantityReceived,
        unitCostMinor: goodsReceiptLines.unitCostMinor,
        landedUnitCostMinor: goodsReceiptLines.landedUnitCostMinor,
        lineTotalMinor: goodsReceiptLines.lineTotalMinor,
        currencyCode: goodsReceiptLines.currencyCode,
        serialNo: productSerials.serialNo,
        lotNo: productLots.lotNo,
      })
      .from(goodsReceiptLines)
      .innerJoin(goodsReceipts, eq(goodsReceiptLines.goodsReceiptId, goodsReceipts.id))
      .innerJoin(products, eq(goodsReceiptLines.productId, products.id))
      .leftJoin(productSerials, eq(goodsReceiptLines.productSerialId, productSerials.id))
      .leftJoin(productLots, eq(goodsReceiptLines.productLotId, productLots.id))
      .where(and(eq(goodsReceipts.purchaseOrderId, id), isNull(goodsReceipts.deletedAt), isNull(goodsReceiptLines.deletedAt)))
      .orderBy(asc(goodsReceipts.receiptDate), asc(goodsReceiptLines.lineNo)),
    db.execute<PurchaseOrderVendorBillDocument>(sql`
      select
        vb.id as "id",
        vb.bill_no as "billNo",
        vb.vendor_reference as "vendorReference",
        vb.status::text as "status",
        vb.bill_date::text as "billDate",
        vb.due_date::text as "dueDate",
        vb.untaxed_amount_minor as "untaxedAmountMinor",
        vb.tax_amount_minor as "taxAmountMinor",
        vb.total_minor as "totalMinor",
        case
          when vb.status = 'cancelled' then 0::bigint
          else greatest(vb.total_minor - coalesce((
            select sum(pa.amount_minor)
            from payment_allocations pa
            inner join payments p on p.id = pa.payment_id
            where pa.vendor_bill_id = vb.id
              and pa.deleted_at is null
              and p.deleted_at is null
              and p.status = 'posted'
          ), 0), 0)::bigint
        end as "residualAmountMinor",
        case
          when coalesce((
            select sum(pa.amount_minor)
            from payment_allocations pa
            inner join payments p on p.id = pa.payment_id
            where pa.vendor_bill_id = vb.id
              and pa.deleted_at is null
              and p.deleted_at is null
              and p.status = 'posted'
          ), 0) <= 0 then 'not_paid'
          when vb.total_minor - coalesce((
            select sum(pa.amount_minor)
            from payment_allocations pa
            inner join payments p on p.id = pa.payment_id
            where pa.vendor_bill_id = vb.id
              and pa.deleted_at is null
              and p.deleted_at is null
              and p.status = 'posted'
          ), 0) <= 0 then 'paid'
          else 'partial'
        end as "paymentStatus",
        vb.currency_code as "currencyCode",
        'vendor_bill' as "source",
        '[]'::json as "lines"
      from vendor_bills vb
      where vb.purchase_order_id = ${id}
        and vb.deleted_at is null
      order by vb.bill_date
    `),
    db.execute<PurchaseOrderVendorBillDocumentLine>(sql`
      select
        vbl.id as "id",
        vbl.vendor_bill_id as "billId",
        vbl.line_no as "lineNo",
        pr.name as "productName",
        pr.sku as "sku",
        vbl.description as "description",
        vbl.quantity::text as "quantity",
        vbl.unit_price_minor as "unitPriceMinor",
        vbl.tax_amount_minor as "taxAmountMinor",
        string_agg(distinct t.name, ', ' order by t.name) as "taxNames",
        vbl.total_minor as "totalMinor",
        vbl.currency_code as "currencyCode"
      from vendor_bill_lines vbl
      inner join vendor_bills vb on vb.id = vbl.vendor_bill_id
      left join products pr on pr.id = vbl.product_id
      left join vendor_bill_line_taxes vblt on vblt.vendor_bill_line_id = vbl.id
      left join taxes t on t.id = vblt.tax_id
      where vb.purchase_order_id = ${id}
        and vb.deleted_at is null
        and vbl.deleted_at is null
      group by vbl.id, pr.id, vb.bill_date
      order by vb.bill_date, vbl.line_no
    `),
    db
      .select({
        id: supplierBillPlaceholders.id,
        billNo: supplierBillPlaceholders.billNo,
        status: supplierBillPlaceholders.status,
        billDate: sql<string>`${supplierBillPlaceholders.billDate}::text`,
        amountMinor: supplierBillPlaceholders.amountMinor,
        currencyCode: supplierBillPlaceholders.currencyCode,
      })
      .from(supplierBillPlaceholders)
      .where(and(eq(supplierBillPlaceholders.purchaseOrderId, id), isNull(supplierBillPlaceholders.deletedAt)))
      .orderBy(asc(supplierBillPlaceholders.billDate)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(goodsReceipts)
      .where(and(eq(goodsReceipts.purchaseOrderId, id), isNull(goodsReceipts.deletedAt))),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(supplierBillPlaceholders)
      .where(and(eq(supplierBillPlaceholders.purchaseOrderId, id), isNull(supplierBillPlaceholders.deletedAt))),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(vendorBills)
      .where(and(eq(vendorBills.purchaseOrderId, id), isNull(vendorBills.deletedAt))),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(landedCosts)
      .where(and(eq(landedCosts.purchaseOrderId, id), isNull(landedCosts.deletedAt))),
    db.execute<{ count: number }>(sql`
      select count(distinct p.id)::int as "count"
      from payments p
      inner join payment_allocations pa on pa.payment_id = p.id
      where pa.purchase_order_id = ${id}
        and p.deleted_at is null
        and pa.deleted_at is null
    `),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(supplierReturns)
      .where(and(eq(supplierReturns.purchaseOrderId, id), isNull(supplierReturns.deletedAt))),
  ]);

  const receiptLinesByReceiptId = new Map<string, PurchaseOrderReceiptDocumentLine[]>();
  for (const line of receiptLineRows) {
    const current = receiptLinesByReceiptId.get(line.receiptId) ?? [];
    current.push(line);
    receiptLinesByReceiptId.set(line.receiptId, current);
  }

  const vendorBillLinesByBillId = new Map<string, PurchaseOrderVendorBillDocumentLine[]>();
  for (const line of vendorBillLineRows) {
    const current = vendorBillLinesByBillId.get(line.billId) ?? [];
    current.push(line);
    vendorBillLinesByBillId.set(line.billId, current);
  }

  const vendorBillDocuments: PurchaseOrderVendorBillDocument[] = [
    ...vendorBillRows.map((bill) => ({
      ...bill,
      source: "vendor_bill" as const,
      lines: vendorBillLinesByBillId.get(bill.id) ?? [],
    })),
    ...placeholderBillRows.map((bill) => ({
      id: bill.id,
      billNo: bill.billNo,
      vendorReference: null,
      status: bill.status,
      billDate: bill.billDate,
      dueDate: null,
      untaxedAmountMinor: bill.amountMinor,
      taxAmountMinor: 0,
      totalMinor: bill.amountMinor,
      residualAmountMinor: bill.status === "cancelled" ? 0 : bill.amountMinor,
      paymentStatus: "not_paid",
      currencyCode: bill.currencyCode,
      source: "placeholder" as const,
      lines: [],
    })),
  ];

  return {
    ...order,
    receiptCount: receiptCountRows[0]?.count ?? 0,
    vendorBillCount: (placeholderBillCountRows[0]?.count ?? 0) + (vendorBillCountRows[0]?.count ?? 0),
    landedCostCount: landedCostCountRows[0]?.count ?? 0,
    paymentCount: paymentCountRows[0]?.count ?? 0,
    returnCount: returnCountRows[0]?.count ?? 0,
    lines: lineRows satisfies PurchaseOrderDetailLine[],
    receipts: receiptRows.map((receipt) => ({
      ...receipt,
      lines: receiptLinesByReceiptId.get(receipt.id) ?? [],
    })) satisfies PurchaseOrderReceiptDocument[],
    vendorBills: vendorBillDocuments,
  };
}

export async function getPurchaseOrderReceiptLines(purchaseOrderId: string): Promise<PurchaseOrderReceiptLine[]> {
  return db
    .select({
      id: purchaseOrderLines.id,
      productId: products.id,
      productName: products.name,
      sku: products.sku,
      trackingMode: products.trackingMode,
      unitId: purchaseOrderLines.unitId,
      currencyCode: purchaseOrderLines.currencyCode,
      quantityOrdered: purchaseOrderLines.quantityOrdered,
      quantityReceived: purchaseOrderLines.quantityReceived,
      unitCostMinor: purchaseOrderLines.unitCostMinor,
    })
    .from(purchaseOrderLines)
    .innerJoin(products, eq(purchaseOrderLines.productId, products.id))
    .where(and(eq(purchaseOrderLines.purchaseOrderId, purchaseOrderId), isNull(purchaseOrderLines.deletedAt)))
    .orderBy(asc(purchaseOrderLines.lineNo));
}
