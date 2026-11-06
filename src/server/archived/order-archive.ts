import "server-only";

import { randomUUID } from "node:crypto";

import { and, eq, isNull, sql, type SQL } from "drizzle-orm";
import { z } from "zod";

import type { db } from "@/server/db/client";
import { auditLogs, serialOwnershipHistory, stockMovementLines, stockMovements } from "@/server/db/schema";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type OrderArchiveType = "sales_order" | "purchase_order";
type ArchiveParams = { entityType: OrderArchiveType; entityId: string; companyId: string; userId: string };

const archiveTables = [
  "sales_orders", "sales_order_lines", "purchase_orders", "purchase_order_lines",
  "deliveries", "delivery_lines", "goods_receipts", "goods_receipt_lines",
  "customer_invoices", "customer_invoice_lines", "vendor_bills", "vendor_bill_lines",
  "supplier_bill_placeholders", "payments", "payment_allocations", "payment_lines",
  "warranty_registrations", "stock_reservations", "landed_costs", "landed_cost_allocations",
] as const;
type ArchiveTable = typeof archiveTables[number];
const balanceSchema = z.object({
  id: z.string().uuid(), quantityOnHand: z.string(), quantityReserved: z.string(), averageCostMinor: z.coerce.number(),
});
const serialSchema = z.object({ id: z.string().uuid(), status: z.enum(["available", "reserved", "in_transit", "sold", "returned", "damaged", "scrapped"]), currentLocationId: z.string().uuid().nullable() });
const manifestSchema = z.object({
  reason: z.string(),
  records: z.array(z.object({ table: z.enum(archiveTables), ids: z.array(z.string().uuid()) })),
  balances: z.array(z.object({ before: balanceSchema, after: balanceSchema })),
  serials: z.array(z.object({ before: serialSchema, after: serialSchema })),
  adjustmentId: z.string().uuid().nullable(),
  pendingSalesApprovals: z.array(z.string().uuid()),
  pendingStockApprovals: z.array(z.string().uuid()),
});
type Manifest = z.infer<typeof manifestSchema>;
type Balance = z.infer<typeof balanceSchema>;

function ids(values: string[]) {
  return values.length ? sql`(${sql.join(values.map((id) => sql`${id}::uuid`), sql`, `)})` : sql`(null::uuid)`;
}

async function changeBalance(tx: Transaction, companyId: string, balanceId: string, quantity: number, reserved = 0, addedCostMinor = 0) {
  const [row] = await tx.execute<Balance>(sql`
    select id, quantity_on_hand::text as "quantityOnHand", quantity_reserved::text as "quantityReserved", average_cost_minor as "averageCostMinor"
    from stock_balances where id = ${balanceId} and company_id = ${companyId} and deleted_at is null for update
  `);
  if (!row) throw new Error("The original stock balance is no longer available.");
  const before = balanceSchema.parse(row);
  const onHand = Number(before.quantityOnHand) + quantity;
  const nextReserved = Number(before.quantityReserved) + reserved;
  if (onHand < -0.0000001 || nextReserved < -0.0000001 || onHand - nextReserved < -0.0000001) {
    throw new Error("Cannot archive: stock has already been consumed, transferred, or reserved by another order.");
  }
  const averageCost = quantity > 0 && onHand > 0
    ? Math.round((Number(before.quantityOnHand) * before.averageCostMinor + addedCostMinor) / onHand)
    : before.averageCostMinor;
  const after = { id: balanceId, quantityOnHand: Math.max(onHand, 0).toFixed(6), quantityReserved: Math.max(nextReserved, 0).toFixed(6), averageCostMinor: averageCost };
  await tx.execute(sql`
    update stock_balances set quantity_on_hand = ${after.quantityOnHand}, quantity_reserved = ${after.quantityReserved},
      quantity_available = ${after.quantityOnHand}::numeric - ${after.quantityReserved}::numeric,
      average_cost_minor = ${averageCost}, last_movement_at = now(), updated_at = now() where id = ${balanceId}
  `);
  return { before, after };
}

async function archiveRecords(tx: Transaction, table: ArchiveTable, predicate: SQL, params: ArchiveParams, manifest: Manifest) {
  const rows = await tx.execute<{ id: string }>(sql`
    update ${sql.identifier(table)} set deleted_at = now(), deleted_by = ${params.userId}, delete_reason = ${manifest.reason}, updated_at = now()
    where deleted_at is null and ${predicate} returning id
  `);
  manifest.records.push({ table, ids: rows.map((row) => row.id) });
}

export async function archiveOrderInTransaction(tx: Transaction, params: ArchiveParams) {
  const sales = params.entityType === "sales_order";
  const orderTable = sales ? "sales_orders" : "purchase_orders";
  const lineTable = sales ? "sales_order_lines" : "purchase_order_lines";
  const orderColumn = sales ? "sales_order_id" : "purchase_order_id";
  const documentTable = sales ? "deliveries" : "goods_receipts";
  const documentLineTable = sales ? "delivery_lines" : "goods_receipt_lines";
  const documentColumn = sales ? "delivery_id" : "goods_receipt_id";
  const billTable = sales ? "customer_invoices" : "vendor_bills";
  const billLineTable = sales ? "customer_invoice_lines" : "vendor_bill_lines";
  const billColumn = sales ? "customer_invoice_id" : "vendor_bill_id";
  const [order] = await tx.execute<{ id: string; orderNo: string; partnerId: string; ownerId: string | null }>(sql`
    select id, order_no as "orderNo", owner_id as "ownerId", ${sql.identifier(sales ? "customer_id" : "supplier_id")} as "partnerId"
    from ${sql.identifier(orderTable)} where id = ${params.entityId} and company_id = ${params.companyId} and deleted_at is null for update
  `);
  if (!order) throw new Error("Order does not exist or is already archived.");

  const documents = sql`select id from ${sql.identifier(documentTable)} where ${sql.identifier(orderColumn)} = ${order.id} and company_id = ${params.companyId}`;
  const bills = sql`select id from ${sql.identifier(billTable)} where company_id = ${params.companyId}
    and (${sql.identifier(orderColumn)} = ${order.id} or ${sql.identifier(documentColumn)} in (${documents}))`;
  const [dependencies] = await tx.execute<{ blocked: boolean }>(sql`
    select exists(select 1 from ${sql.identifier(sales ? "customer_returns" : "supplier_returns")}
      where company_id = ${params.companyId} and deleted_at is null
        and (${sql.identifier(orderColumn)} = ${order.id} or ${sql.identifier(documentColumn)} in (${documents}))) as blocked
  `);
  if (dependencies?.blocked) throw new Error("This order has returns. Reverse the returns before archiving the order.");
  if (!sales) {
    const [cost] = await tx.execute<{ blocked: boolean }>(sql`
      select exists(select 1 from landed_costs where company_id = ${params.companyId} and deleted_at is null
        and status = 'posted' and (purchase_order_id = ${order.id} or goods_receipt_id in (${documents}))) as blocked
    `);
    if (cost?.blocked) throw new Error("This purchase has posted landed costs. Correct those costs before archiving.");
  }

  const allocationTarget = sql`${sql.identifier(orderColumn)} = ${order.id} or ${sql.identifier(billColumn)} in (${bills})`;
  const paymentRows = await tx.execute<{ id: string }>(sql`
    select p.id from payments p where p.company_id = ${params.companyId} and p.deleted_at is null
      and exists(select 1 from payment_allocations where payment_id = p.id and deleted_at is null and (${allocationTarget}))
    order by p.id for update
  `);
  const paymentIds = paymentRows.map((row) => row.id);
  const [shared] = await tx.execute<{ blocked: boolean }>(sql`
    select exists(select 1 from payment_allocations where payment_id in ${ids(paymentIds)} and deleted_at is null
      and not (coalesce(${sql.identifier(orderColumn)} = ${order.id}, false)
        or coalesce(${sql.identifier(billColumn)} in (${bills}), false))) as blocked
  `);
  if (shared?.blocked) throw new Error("A linked payment also covers another document. Separate its allocations before archiving this order.");

  const manifest: Manifest = { reason: `order-archive:${params.entityType}:${order.id}:${randomUUID()}`, records: [], balances: [], serials: [], adjustmentId: null, pendingSalesApprovals: [], pendingStockApprovals: [] };
  const [incompleteStock] = await tx.execute<{ blocked: boolean }>(sql`
    select exists(select 1 from ${sql.identifier(documentTable)} d left join stock_movements m on m.id = d.stock_movement_id
      where d.id in (${documents}) and d.deleted_at is null and d.status = 'posted'
        and (m.id is null or m.company_id <> ${params.companyId} or m.deleted_at is not null or m.status <> 'posted'
          or m.movement_type <> ${sales ? "sale_delivery" : "purchase_receipt"}
          or not exists(select 1 from stock_movement_lines l where l.stock_movement_id = m.id and l.deleted_at is null))) as blocked
  `);
  if (incompleteStock?.blocked) throw new Error("A posted receipt or delivery has incomplete stock history. Correct it before archiving.");
  if (sales) {
    const reservations = await tx.execute<{ id: string; balanceId: string | null; quantity: string }>(sql`
      select r.id, b.id as "balanceId", r.quantity::text from stock_reservations r
      inner join sales_order_lines l on l.id = r.source_id and l.sales_order_id = ${order.id}
      left join stock_balances b on b.company_id = r.company_id and b.location_id = r.location_id and b.product_id = r.product_id
        and b.owner_id is not distinct from coalesce(l.owner_id, ${order.ownerId}::uuid) and b.product_serial_id is not distinct from r.product_serial_id
        and b.product_lot_id is not distinct from r.product_lot_id and b.deleted_at is null
      where r.company_id = ${params.companyId} and r.source_type = 'sales_order_line' and r.status = 'active' and r.deleted_at is null
      order by r.id for update of r
    `);
    for (const reservation of reservations) {
      if (!reservation.balanceId) throw new Error("A stock reservation has no matching balance. Correct it before archiving.");
      manifest.balances.push(await changeBalance(tx, params.companyId, reservation.balanceId, 0, -Number(reservation.quantity)));
    }
  }

  const movementRows = await tx.execute<{ id: string }>(sql`
    select m.id from stock_movements m where m.company_id = ${params.companyId} and m.status = 'posted' and m.deleted_at is null
      and m.id in (select stock_movement_id from ${sql.identifier(documentTable)} where id in (${documents}) and deleted_at is null and status = 'posted')
    order by m.id for update
  `);
  const movementIds = movementRows.map((row) => row.id);
  const movementLines = await tx.execute<{
    id: string; movementId: string; balanceId: string | null; ownerId: string | null; productId: string;
    productSerialId: string | null; productLotId: string | null; fromLocationId: string | null; toLocationId: string | null;
    unitId: string; quantity: string; totalCostMinor: number; currencyCode: string;
  }>(sql`
    select l.id, l.stock_movement_id as "movementId", b.id as "balanceId", l.owner_id as "ownerId", l.product_id as "productId",
      l.product_serial_id as "productSerialId", l.product_lot_id as "productLotId", l.from_location_id as "fromLocationId",
      l.to_location_id as "toLocationId", l.unit_id as "unitId", l.quantity::text, l.total_cost_minor as "totalCostMinor", l.currency_code as "currencyCode"
    from stock_movement_lines l left join stock_balances b on b.company_id = ${params.companyId}
      and b.location_id = ${sales ? sql`l.from_location_id` : sql`l.to_location_id`} and b.product_id = l.product_id
      and b.owner_id is not distinct from l.owner_id and b.product_serial_id is not distinct from l.product_serial_id
      and b.product_lot_id is not distinct from l.product_lot_id and b.deleted_at is null
    where l.stock_movement_id in ${ids(movementIds)} and l.deleted_at is null order by l.id
  `);
  if (movementLines.length) {
    const [adjustment] = await tx.insert(stockMovements).values({
      companyId: params.companyId, movementNo: `ARC-${randomUUID()}`, movementType: "adjustment", status: "posted",
      sourceType: "order_archive", sourceId: order.id, sourceNo: order.orderNo, postedAt: new Date(), postedBy: params.userId,
      metadata: { archiveReason: manifest.reason }, notes: `Stock reversal for archived ${order.orderNo}`,
    }).returning({ id: stockMovements.id });
    manifest.adjustmentId = adjustment.id;
    for (const [index, line] of movementLines.entries()) {
      if (!line.balanceId || Number(line.quantity) <= 0) throw new Error("The original stock movement cannot be reversed automatically.");
      // Later use of a received item (or a delivered serial) must be resolved first.
      if (!sales || line.productSerialId) {
        const [later] = await tx.execute<{ blocked: boolean }>(sql`
          select exists(select 1 from stock_movement_lines other inner join stock_movements m on m.id = other.stock_movement_id
            inner join stock_movements original on original.id = ${line.movementId}
            where m.company_id = ${params.companyId} and m.status = 'posted' and m.deleted_at is null and other.deleted_at is null
              and m.id not in ${ids(movementIds)} and m.source_id is distinct from ${order.id}::uuid
              and coalesce(m.source_type, '') not in ('order_archive', 'order_restore')
              and not exists(select 1 from deliveries archived_delivery where archived_delivery.stock_movement_id = m.id
                and archived_delivery.deleted_at is not null and archived_delivery.delete_reason like 'order-archive:%')
              and m.movement_date >= original.movement_date and other.product_id = ${line.productId}
              and other.owner_id is not distinct from ${line.ownerId}::uuid
              and other.product_serial_id is not distinct from ${line.productSerialId}::uuid
              and other.product_lot_id is not distinct from ${line.productLotId}::uuid
              and (${line.productSerialId}::uuid is not null or other.from_location_id = ${line.toLocationId})) as blocked
        `);
        if (later?.blocked) throw new Error("Received stock or a delivered serial has later movements. Reverse those movements before archiving this order.");
      }
      manifest.balances.push(await changeBalance(tx, params.companyId, line.balanceId, Number(line.quantity) * (sales ? 1 : -1), 0, Number(line.totalCostMinor)));
      await tx.insert(stockMovementLines).values({
        stockMovementId: adjustment.id, ownerId: line.ownerId, lineNo: index + 1, productId: line.productId,
        productSerialId: line.productSerialId, productLotId: line.productLotId,
        fromLocationId: line.toLocationId, toLocationId: line.fromLocationId, unitId: line.unitId,
        quantity: line.quantity, totalCostMinor: Number(line.totalCostMinor), currencyCode: line.currencyCode,
        metadata: { originalLineId: line.id },
      });
      if (line.productSerialId) {
        const [serial] = await tx.execute<z.infer<typeof serialSchema>>(sql`
          select id, status, current_location_id as "currentLocationId" from product_serials where id = ${line.productSerialId} and deleted_at is null for update
        `);
        if (!serial || (sales ? serial.status !== "sold" : serial.currentLocationId !== line.toLocationId || !["available", "returned"].includes(serial.status))) {
          throw new Error("A serial number has changed ownership or location. Resolve that activity before archiving.");
        }
        const before = serialSchema.parse(serial);
        const after = { ...before, status: sales ? "available" as const : "returned" as const, currentLocationId: sales ? line.fromLocationId : null };
        await tx.execute(sql`update product_serials set status = ${after.status}::serial_status, current_location_id = ${after.currentLocationId}, updated_at = now() where id = ${before.id}`);
        manifest.serials.push({ before, after });
        if (sales) await tx.insert(serialOwnershipHistory).values({ companyId: params.companyId, productSerialId: serial.id, partnerId: order.partnerId,
          ownershipType: "customer_return", sourceType: "order_archive", sourceId: order.id, sourceNo: order.orderNo, notes: manifest.reason });
      }
    }
  }

  await archiveRecords(tx, documentLineTable, sql`${sql.identifier(documentColumn)} in (${documents})`, params, manifest);
  await archiveRecords(tx, documentTable, sql`id in (${documents}) and company_id = ${params.companyId}`, params, manifest);
  await archiveRecords(tx, billLineTable, sql`${sql.identifier(billColumn)} in (${bills})`, params, manifest);
  await archiveRecords(tx, billTable, sql`id in (${bills}) and company_id = ${params.companyId}`, params, manifest);
  await archiveRecords(tx, "payment_lines", sql`payment_id in ${ids(paymentIds)} and company_id = ${params.companyId}`, params, manifest);
  await archiveRecords(tx, "payment_allocations", sql`payment_id in ${ids(paymentIds)}`, params, manifest);
  await archiveRecords(tx, "payments", sql`id in ${ids(paymentIds)} and company_id = ${params.companyId}`, params, manifest);
  if (sales) {
    await archiveRecords(tx, "warranty_registrations", sql`company_id = ${params.companyId} and (sales_order_id = ${order.id} or delivery_id in (${documents}))`, params, manifest);
    await archiveRecords(tx, "stock_reservations", sql`company_id = ${params.companyId} and source_type = 'sales_order_line' and source_id in (select id from sales_order_lines where sales_order_id = ${order.id})`, params, manifest);
    const approvals = await tx.execute<{ id: string }>(sql`update sales_line_approvals set status = 'cancelled', updated_at = now()
      where sales_order_id = ${order.id} and company_id = ${params.companyId} and status = 'pending' returning id`);
    manifest.pendingSalesApprovals = approvals.map((row) => row.id);
    const stockApprovals = await tx.execute<{ id: string }>(sql`update stock_out_approvals set status = 'cancelled', cancelled_at = now(), updated_at = now()
      where source_type = 'delivery' and source_id in (${documents}) and company_id = ${params.companyId} and status = 'pending' returning id`);
    manifest.pendingStockApprovals = stockApprovals.map((row) => row.id);
  } else {
    await archiveRecords(tx, "supplier_bill_placeholders", sql`purchase_order_id = ${order.id} and company_id = ${params.companyId}`, params, manifest);
    const costs = sql`select id from landed_costs where company_id = ${params.companyId} and (purchase_order_id = ${order.id} or goods_receipt_id in (${documents}))`;
    await archiveRecords(tx, "landed_cost_allocations", sql`landed_cost_id in (${costs})`, params, manifest);
    await archiveRecords(tx, "landed_costs", sql`id in (${costs}) and company_id = ${params.companyId}`, params, manifest);
  }
  await archiveRecords(tx, lineTable, sql`${sql.identifier(orderColumn)} = ${order.id}`, params, manifest);
  await archiveRecords(tx, orderTable, sql`id = ${order.id} and company_id = ${params.companyId}`, params, manifest);
  await tx.insert(auditLogs).values({ companyId: params.companyId, actorUserId: params.userId, action: `${params.entityType}.archive`,
    entityType: params.entityType, entityId: order.id, severity: "warning", metadata: { orderNo: order.orderNo, manifest } });
}

export async function restoreOrderInTransaction(tx: Transaction, params: ArchiveParams) {
  const table = params.entityType === "sales_order" ? "sales_orders" : "purchase_orders";
  const [order] = await tx.execute<{ orderNo: string; reason: string | null; partnerId: string }>(sql`
    select order_no as "orderNo", delete_reason as reason, ${sql.identifier(params.entityType === "sales_order" ? "customer_id" : "supplier_id")} as "partnerId" from ${sql.identifier(table)}
    where id = ${params.entityId} and company_id = ${params.companyId} and deleted_at is not null for update
  `);
  if (!order) throw new Error("Archived order does not exist.");
  // Orders archived before batch archiving retain the original single-record restore.
  if (!order.reason?.startsWith("order-archive:")) {
    await tx.execute(sql`update ${sql.identifier(table)} set deleted_at = null, deleted_by = null, delete_reason = null, updated_at = now()
      where id = ${params.entityId} and company_id = ${params.companyId}`);
    return;
  }
  const [audit] = await tx.select({ metadata: auditLogs.metadata }).from(auditLogs).where(and(
    eq(auditLogs.companyId, params.companyId), eq(auditLogs.entityId, params.entityId), eq(auditLogs.action, `${params.entityType}.archive`),
    sql`${auditLogs.metadata}->'manifest'->>'reason' = ${order.reason}`,
  )).limit(1);
  const manifest = manifestSchema.parse((audit?.metadata as { manifest?: unknown } | undefined)?.manifest);

  for (const { before, after } of [...manifest.balances].reverse()) {
    const [current] = await tx.execute<Balance>(sql`select id, quantity_on_hand::text as "quantityOnHand", quantity_reserved::text as "quantityReserved",
      average_cost_minor as "averageCostMinor" from stock_balances where id = ${after.id} and company_id = ${params.companyId} and deleted_at is null for update`);
    if (!current || Number(current.quantityOnHand) !== Number(after.quantityOnHand) || Number(current.quantityReserved) !== Number(after.quantityReserved)
      || Number(current.averageCostMinor) !== after.averageCostMinor) throw new Error("Stock changed after archiving. Resolve subsequent stock activity before restoring this order.");
    await tx.execute(sql`update stock_balances set quantity_on_hand = ${before.quantityOnHand}, quantity_reserved = ${before.quantityReserved},
      quantity_available = ${before.quantityOnHand}::numeric - ${before.quantityReserved}::numeric, average_cost_minor = ${before.averageCostMinor},
      last_movement_at = now(), updated_at = now() where id = ${before.id}`);
  }
  for (const { before, after } of [...manifest.serials].reverse()) {
    const [restored] = await tx.execute<{ id: string }>(sql`update product_serials set status = ${before.status}::serial_status,
      current_location_id = ${before.currentLocationId}, updated_at = now()
      where id = ${before.id} and deleted_at is null and status = ${after.status}::serial_status
        and current_location_id is not distinct from ${after.currentLocationId}::uuid returning id`);
    if (!restored) throw new Error("A serial number changed after archiving. Resolve that activity before restoring.");
    if (params.entityType === "sales_order") await tx.insert(serialOwnershipHistory).values({ companyId: params.companyId, productSerialId: before.id,
      partnerId: order.partnerId, ownershipType: "sale", sourceType: "order_restore", sourceId: params.entityId, sourceNo: order.orderNo, notes: manifest.reason });
  }
  if (manifest.adjustmentId) {
    const [adjustment] = await tx.insert(stockMovements).values({ companyId: params.companyId, movementNo: `RST-${randomUUID()}`,
      movementType: "adjustment", status: "posted", sourceType: "order_restore", sourceId: params.entityId, sourceNo: order.orderNo,
      postedAt: new Date(), postedBy: params.userId, metadata: { archiveReason: manifest.reason }, notes: `Stock restored with ${order.orderNo}` }).returning({ id: stockMovements.id });
    const reversalLines = await tx.select().from(stockMovementLines).where(and(eq(stockMovementLines.stockMovementId, manifest.adjustmentId), isNull(stockMovementLines.deletedAt)));
    if (!reversalLines.length) throw new Error("The archive stock reversal is missing.");
    await tx.insert(stockMovementLines).values(reversalLines.map((line) => ({ stockMovementId: adjustment.id, lineNo: line.lineNo, ownerId: line.ownerId,
      productId: line.productId, productSerialId: line.productSerialId, productLotId: line.productLotId,
      fromLocationId: line.toLocationId, toLocationId: line.fromLocationId, unitId: line.unitId, quantity: line.quantity,
      totalCostMinor: line.totalCostMinor, currencyCode: line.currencyCode })));
  }
  for (const record of [...manifest.records].reverse()) {
    const restored = await tx.execute<{ id: string }>(sql`update ${sql.identifier(record.table)} set deleted_at = null, deleted_by = null, delete_reason = null, updated_at = now()
      where id in ${ids(record.ids)} and delete_reason = ${manifest.reason} and deleted_at is not null returning id`);
    if (restored.length !== record.ids.length) throw new Error("An archived record changed. Restore was cancelled to keep the order and its documents consistent.");
  }
  await tx.execute(sql`update sales_line_approvals set status = 'pending', updated_at = now() where id in ${ids(manifest.pendingSalesApprovals)} and company_id = ${params.companyId} and status = 'cancelled'`);
  await tx.execute(sql`update stock_out_approvals set status = 'pending', cancelled_at = null, updated_at = now() where id in ${ids(manifest.pendingStockApprovals)} and company_id = ${params.companyId} and status = 'cancelled'`);
  await tx.insert(auditLogs).values({ companyId: params.companyId, actorUserId: params.userId, action: `${params.entityType}.restore`,
    entityType: params.entityType, entityId: params.entityId, severity: "warning", metadata: { orderNo: order.orderNo, archiveReason: manifest.reason } });
}
