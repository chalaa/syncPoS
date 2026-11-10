import "dotenv/config";

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { archiveOrderInTransaction, restoreOrderInTransaction, type OrderArchiveType } from "../src/server/archived/order-archive";
import { getArchivedModelRows, type ArchivedModel } from "../src/server/archived/model-archives";
import * as s from "../src/server/db/schema";

const client = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });
const database = drizzle(client, { schema: s });
type Tx = Parameters<Parameters<typeof database.transaction>[0]>[0];
const rollback = new Error("Rollback archive smoke fixtures");

async function main() {
  try {
    await database.transaction(async (tx) => {
      const suffix = randomUUID().slice(0, 8);
      await tx.insert(s.currencies).values({ code: "ETB", name: "Ethiopian Birr" }).onConflictDoNothing();
      const [company] = await tx.insert(s.companies).values({ code: `ARC-${suffix}`, legalName: "Archive smoke company", baseCurrencyCode: "ETB" }).returning();
      const [user] = await tx.insert(s.users).values({ companyId: company.id, username: "archive-test", passwordHash: "unused-test-account" }).returning({ id: s.users.id });
      const [unit] = await tx.insert(s.unitsOfMeasure).values({ companyId: company.id, code: `ARC-${suffix}`, name: "Archive smoke unit" }).returning();
      const [partner] = await tx.insert(s.partners).values({ companyId: company.id, code: `ARC-${suffix}`, displayName: "Archive smoke partner", isCustomer: true, isSupplier: true, currencyCode: company.baseCurrencyCode }).returning();
      const [owner] = await tx.insert(s.owners).values({ companyId: company.id, name: `Archive smoke ${suffix}` }).returning();
      const [location] = await tx.insert(s.locations).values({ companyId: company.id, code: `ARC-${suffix}`, name: "Archive smoke warehouse", locationType: "warehouse" }).returning();
      const [external] = await tx.insert(s.locations).values({ companyId: company.id, code: `EXT-${suffix}`, name: "Archive smoke external", locationType: "supplier" }).returning();
      const [method] = await tx.insert(s.paymentMethods).values({ companyId: company.id, code: `ARC-${suffix}`, name: "Archive smoke cash", methodType: "cash", allowOutbound: true }).returning();
      const [account] = await tx.insert(s.paymentAccounts).values({ companyId: company.id, paymentMethodId: method.id, code: `ARC-${suffix}`, name: "Archive smoke account", currencyCode: company.baseCurrencyCode }).returning();

      async function fixture(entityType: OrderArchiveType, tracking: "none" | "serial" | "lot" = "none", reserved = 0) {
        const sales = entityType === "sales_order";
        const code = `ARC-${randomUUID()}`;
        const [product] = await tx.insert(s.products).values({ companyId: company.id, sku: code, name: "Archive smoke product", unitId: unit.id, currencyCode: company.baseCurrencyCode, trackingMode: tracking }).returning();
        const [serial] = tracking === "serial" ? await tx.insert(s.productSerials).values({ productId: product.id, serialNo: code, status: sales ? "sold" : "available", currentLocationId: sales ? null : location.id }).returning() : [];
        const [lot] = tracking === "lot" ? await tx.insert(s.productLots).values({ productId: product.id, lotNo: code, currentLocationId: location.id }).returning() : [];
        const [order] = sales
          ? await tx.insert(s.salesOrders).values({ companyId: company.id, customerId: partner.id, ownerId: owner.id, sourceLocationId: location.id, orderNo: code, currencyCode: company.baseCurrencyCode,
              status: reserved ? "partially_delivered" : "delivered", confirmedAt: new Date(), totalMinor: 10000 }).returning()
          : await tx.insert(s.purchaseOrders).values({ companyId: company.id, supplierId: partner.id, ownerId: owner.id, deliverToLocationId: location.id, orderNo: code, currencyCode: company.baseCurrencyCode,
              status: "received", confirmedAt: new Date(), totalMinor: 10000 }).returning();
        const qty = tracking === "serial" ? 1 : 4;
        const [line] = sales
          ? await tx.insert(s.salesOrderLines).values({ salesOrderId: order.id, ownerId: owner.id, sourceLocationId: location.id, productId: product.id, lineNo: 1, unitId: unit.id,
              quantityOrdered: String(qty + reserved), quantityDelivered: String(qty), quantityReserved: String(reserved), currencyCode: company.baseCurrencyCode }).returning()
          : await tx.insert(s.purchaseOrderLines).values({ purchaseOrderId: order.id, ownerId: owner.id, productId: product.id, lineNo: 1, unitId: unit.id,
              quantityOrdered: String(qty), quantityReceived: String(qty), currencyCode: company.baseCurrencyCode }).returning();
        const [movement] = await tx.insert(s.stockMovements).values({ companyId: company.id, ownerId: owner.id, movementNo: code, movementType: sales ? "sale_delivery" : "purchase_receipt", status: "posted",
          postedAt: new Date(), fromLocationId: sales ? location.id : external.id, toLocationId: sales ? external.id : location.id }).returning();
        const [document] = sales
          ? await tx.insert(s.deliveries).values({ companyId: company.id, salesOrderId: order.id, customerId: partner.id, sourceLocationId: location.id,
              deliveryNo: code, status: "posted", postedAt: new Date(), stockMovementId: movement.id }).returning()
          : await tx.insert(s.goodsReceipts).values({ companyId: company.id, purchaseOrderId: order.id, supplierId: partner.id, locationId: location.id,
              receiptNo: code, status: "posted", postedAt: new Date(), stockMovementId: movement.id }).returning();
        if (sales) await tx.insert(s.deliveryLines).values({ deliveryId: document.id, salesOrderLineId: line.id, lineNo: 1, productId: product.id,
          productSerialId: serial?.id, productLotId: lot?.id, unitId: unit.id, quantityDelivered: String(qty), totalCostMinor: qty * 100, currencyCode: company.baseCurrencyCode });
        else await tx.insert(s.goodsReceiptLines).values({ goodsReceiptId: document.id, purchaseOrderLineId: line.id, lineNo: 1, productId: product.id,
          productSerialId: serial?.id, productLotId: lot?.id, unitId: unit.id, quantityReceived: String(qty), lineTotalMinor: qty * 100, currencyCode: company.baseCurrencyCode });
        await tx.insert(s.stockMovementLines).values({ stockMovementId: movement.id, ownerId: owner.id, lineNo: 1, productId: product.id, productSerialId: serial?.id, productLotId: lot?.id,
          unitId: unit.id, quantity: String(qty), totalCostMinor: qty * 100, currencyCode: company.baseCurrencyCode,
          fromLocationId: sales ? location.id : external.id, toLocationId: sales ? external.id : location.id });
        const onHand = sales ? reserved : qty;
        const [balance] = await tx.insert(s.stockBalances).values({ companyId: company.id, ownerId: owner.id, locationId: location.id, productId: product.id, productSerialId: serial?.id, productLotId: lot?.id,
          quantityOnHand: String(onHand), quantityReserved: String(reserved), quantityAvailable: String(onHand - reserved), averageCostMinor: 100, currencyCode: company.baseCurrencyCode }).returning();
        if (reserved) await tx.insert(s.stockReservations).values({ companyId: company.id, reservationNo: code, locationId: location.id, productId: product.id,
          sourceType: "sales_order_line", sourceId: line.id, quantity: String(reserved) });
        const [payment] = await tx.insert(s.payments).values({ companyId: company.id, partnerId: partner.id, paymentNo: code, paymentType: sales ? "inbound" : "outbound", status: "posted",
          postedAt: new Date(), paymentMethodId: method.id, paymentAccountId: account.id, amountMinor: 6000, currencyCode: company.baseCurrencyCode }).returning();
        await tx.insert(s.paymentAllocations).values({ paymentId: payment.id, salesOrderId: sales ? order.id : null, purchaseOrderId: sales ? null : order.id, amountMinor: 6000 });
        await tx.insert(s.paymentLines).values({ companyId: company.id, paymentId: payment.id, lineNo: 1, paymentMethodId: method.id, paymentAccountId: account.id, amountMinor: 6000 });
        return { params: { entityType, entityId: order.id, companyId: company.id, userId: user.id }, order, document, product, serial, balance, payment, qty, reserved };
      }

      async function state(t: Tx, f: Awaited<ReturnType<typeof fixture>>) {
        const [balance] = await t.select().from(s.stockBalances).where(eq(s.stockBalances.id, f.balance.id));
        const [payment] = await t.select().from(s.payments).where(eq(s.payments.id, f.payment.id));
        return { balance, payment };
      }

      async function assertDocumentsArchived(f: Awaited<ReturnType<typeof fixture>>, archived: boolean) {
        const sales = f.params.entityType === "sales_order";
        for (const [table, column, id] of [
          [sales ? "sales_orders" : "purchase_orders", "id", f.order.id],
          [sales ? "sales_order_lines" : "purchase_order_lines", sales ? "sales_order_id" : "purchase_order_id", f.order.id],
          [sales ? "deliveries" : "goods_receipts", "id", f.document.id],
          [sales ? "delivery_lines" : "goods_receipt_lines", sales ? "delivery_id" : "goods_receipt_id", f.document.id],
          ["payment_lines", "payment_id", f.payment.id], ["payment_allocations", "payment_id", f.payment.id],
        ]) {
          const rows = await tx.execute<{ archived: boolean }>(sql`select deleted_at is not null as archived from ${sql.identifier(table)} where ${sql.identifier(column)} = ${id}`);
          assert(rows.length > 0);
          assert(rows.every((row) => row.archived === archived), `${table} archive state must match order`);
        }
      }

      for (const entityType of ["purchase_order", "sales_order"] as const) {
        for (const tracking of ["none", "serial", "lot"] as const) {
          const f = await fixture(entityType, tracking);
          const listParams = { q: f.order.orderNo, locationId: null };
          assert.equal((await getArchivedModelRows(entityType, company.id, listParams, tx)).length, 0, "Active orders must not appear in archives");
          await archiveOrderInTransaction(tx, f.params);
          const archivedOrders = await getArchivedModelRows(entityType, company.id, listParams, tx);
          assert.equal(archivedOrders.length, 1);
          assert.equal(archivedOrders[0].reference, f.order.orderNo);
          assert.equal((await getArchivedModelRows(entityType, company.id, { ...listParams, paymentStatus: "partially_paid" }, tx)).length, 1, "Archived payments must count in historical payment status");
          assert.equal((await getArchivedModelRows(entityType, company.id, { ...listParams, paymentStatus: "fully_paid" }, tx)).length, 0);
          assert.equal((await getArchivedModelRows(entityType, company.id, { ...listParams, paymentTerm: "cash" }, tx)).length, 1);
          assert.equal((await getArchivedModelRows(entityType, company.id, { ...listParams, paymentTerm: "credit" }, tx)).length, 0);
          assert.equal((await getArchivedModelRows(entityType, randomUUID(), listParams, tx)).length, 0, "Archive lists must respect company scope");
          assert.equal((await getArchivedModelRows(entityType, company.id, { ...listParams, locationId: randomUUID() }, tx)).length, 0, "Archive lists must respect shop scope");
          assert.equal((await getArchivedModelRows(entityType, company.id, { ...listParams, status: "not-a-real-status" }, tx)).length, 0);
          const sales = entityType === "sales_order";
          const parentFilter = sales ? { salesOrderId: f.order.id } : { purchaseOrderId: f.order.id };
          const archivedDocuments = await getArchivedModelRows(sales ? "delivery" : "receipt", company.id, { ...listParams, ...parentFilter }, tx);
          assert.equal(archivedDocuments.length, 1);
          assert.equal(archivedDocuments[0].parentId, f.order.id);
          assert.equal(archivedDocuments[0].parentArchived, true);
          assert.equal(archivedDocuments[0].amountMinor, f.qty * 100, "Archived line totals must remain visible");
          const archivedPayments = await getArchivedModelRows(sales ? "customer_payment" : "supplier_payment", company.id, { ...listParams, ...parentFilter }, tx);
          assert.equal(archivedPayments.length, 1, "Archived payment allocations must still identify their parent order");
          assert.equal(archivedPayments[0].parentReference, f.order.orderNo);
          const archived = await state(tx, f);
          await assertDocumentsArchived(f, true);
          assert(archived.payment.deletedAt, "Registered payment must archive");
          assert.equal(Number(archived.balance.quantityOnHand), entityType === "sales_order" ? f.qty : 0);
          if (f.serial) {
            const [serial] = await tx.select().from(s.productSerials).where(eq(s.productSerials.id, f.serial.id));
            assert.equal(serial.status, entityType === "sales_order" ? "available" : "returned");
          }
          await restoreOrderInTransaction(tx, f.params);
          const restored = await state(tx, f);
          assert.equal((await getArchivedModelRows(entityType, company.id, listParams, tx)).length, 0, "Restored orders must leave archive lists");
          await assertDocumentsArchived(f, false);
          assert.equal(restored.payment.deletedAt, null);
          assert.equal(restored.balance.quantityOnHand, f.balance.quantityOnHand);
          assert.equal(restored.balance.averageCostMinor, f.balance.averageCostMinor);
          // Repeated archive/restore must not reverse the same stock twice.
          await archiveOrderInTransaction(tx, f.params);
          await restoreOrderInTransaction(tx, f.params);
          assert.equal((await state(tx, f)).balance.quantityOnHand, f.balance.quantityOnHand);
          console.log(`PASS ${entityType}: ${tracking} stock and payment archive/restore`);
        }
      }

      const reserved = await fixture("sales_order", "none", 2);
      await archiveOrderInTransaction(tx, reserved.params);
      assert.equal(Number((await state(tx, reserved)).balance.quantityReserved), 0);
      await restoreOrderInTransaction(tx, reserved.params);
      assert.equal(Number((await state(tx, reserved)).balance.quantityReserved), 2);
      console.log("PASS sales reservations release and restore");

      const insufficient = await fixture("purchase_order");
      await tx.update(s.stockBalances).set({ quantityOnHand: "1", quantityAvailable: "1" }).where(eq(s.stockBalances.id, insufficient.balance.id));
      await assert.rejects(tx.transaction((nested) => archiveOrderInTransaction(nested, insufficient.params)), /consumed|transferred|reserved/);
      assert.equal((await state(tx, insufficient)).payment.deletedAt, null);
      console.log("PASS insufficient stock blocks whole archive");

      const shared = await fixture("purchase_order");
      const other = await fixture("purchase_order");
      await tx.insert(s.paymentAllocations).values({ paymentId: shared.payment.id, purchaseOrderId: other.order.id, amountMinor: 1 });
      await assert.rejects(tx.transaction((nested) => archiveOrderInTransaction(nested, shared.params)), /another document/);
      console.log("PASS shared payments cannot archive unrelated orders");

      const changed = await fixture("sales_order");
      await archiveOrderInTransaction(tx, changed.params);
      await tx.update(s.stockBalances).set({ quantityOnHand: "3", quantityAvailable: "3" }).where(eq(s.stockBalances.id, changed.balance.id));
      await assert.rejects(tx.transaction((nested) => restoreOrderInTransaction(nested, changed.params)), /Stock changed/);
      assert((await state(tx, changed)).payment.deletedAt);
      console.log("PASS changed stock blocks partial restoration");

      const wrongCompany = await fixture("purchase_order");
      await assert.rejects(tx.transaction((nested) => archiveOrderInTransaction(nested, { ...wrongCompany.params, companyId: randomUUID() })), /does not exist/);
      console.log("PASS company isolation");

      const downstream = await fixture("purchase_order");
      const [transfer] = await tx.insert(s.stockMovements).values({ companyId: company.id, movementNo: `LATER-${randomUUID()}`, movementType: "transfer", status: "posted",
        fromLocationId: location.id, toLocationId: external.id, postedAt: new Date() }).returning();
      await tx.insert(s.stockMovementLines).values({ stockMovementId: transfer.id, lineNo: 1, ownerId: owner.id, productId: downstream.product.id, unitId: unit.id,
        quantity: "1", currencyCode: company.baseCurrencyCode, fromLocationId: location.id, toLocationId: external.id });
      await assert.rejects(tx.transaction((nested) => archiveOrderInTransaction(nested, downstream.params)), /later movements/);
      console.log("PASS downstream stock movement blocks purchase archive");

      const independentlyArchived = await fixture("purchase_order");
      await tx.update(s.payments).set({ deletedAt: new Date(), deleteReason: "Previously archived separately" }).where(eq(s.payments.id, independentlyArchived.payment.id));
      await archiveOrderInTransaction(tx, independentlyArchived.params);
      await restoreOrderInTransaction(tx, independentlyArchived.params);
      assert((await state(tx, independentlyArchived)).payment.deletedAt, "Restore must not restore previously archived payments");
      console.log("PASS existing archives stay archived during batch restore");

      const purchaseThenSale = await fixture("purchase_order");
      const linkedSale = await fixture("sales_order");
      await tx.delete(s.stockBalances).where(eq(s.stockBalances.id, linkedSale.balance.id));
      await tx.update(s.salesOrderLines).set({ productId: purchaseThenSale.product.id }).where(eq(s.salesOrderLines.salesOrderId, linkedSale.order.id));
      await tx.update(s.deliveryLines).set({ productId: purchaseThenSale.product.id }).where(eq(s.deliveryLines.deliveryId, linkedSale.document.id));
      await tx.update(s.stockMovementLines).set({ productId: purchaseThenSale.product.id }).where(eq(s.stockMovementLines.stockMovementId, linkedSale.document.stockMovementId!));
      await tx.update(s.stockBalances).set({ quantityOnHand: "0", quantityAvailable: "0" }).where(eq(s.stockBalances.id, purchaseThenSale.balance.id));
      await archiveOrderInTransaction(tx, linkedSale.params);
      await archiveOrderInTransaction(tx, purchaseThenSale.params);
      assert.equal(Number((await state(tx, purchaseThenSale)).balance.quantityOnHand), 0);
      await restoreOrderInTransaction(tx, purchaseThenSale.params);
      await restoreOrderInTransaction(tx, linkedSale.params);
      assert.equal(Number((await state(tx, purchaseThenSale)).balance.quantityOnHand), 0);
      console.log("PASS purchase can archive after linked sales are archived and stock is returned");

      for (const model of ["sales_order", "purchase_order", "delivery", "receipt", "customer_invoice", "landed_cost", "customer_return", "supplier_return", "customer_payment", "supplier_payment", "direct_vendor_sale", "expense", "role"] as ArchivedModel[]) {
        await getArchivedModelRows(model, company.id, { locationId: null, q: "no-matching-record" }, tx, { userId: user.id, canSeeAll: true });
      }
      console.log("PASS archive queries for all transaction models and roles");

      const [category] = await tx.insert(s.expenseCategories).values({ companyId: company.id, code: `ARC-${suffix}`, name: "Archive smoke category" }).returning();
      const [expense] = await tx.insert(s.expenses).values({ companyId: company.id, expenseNo: `ARC-${suffix}`, categoryId: category.id,
        createdBy: user.id, amountMinor: 100, currencyCode: company.baseCurrencyCode, deletedAt: new Date() }).returning();
      const expenseParams = { locationId: null, q: expense.expenseNo! };
      assert.equal((await getArchivedModelRows("expense", company.id, expenseParams, tx, { userId: user.id, canSeeAll: false })).length, 1);
      assert.equal((await getArchivedModelRows("expense", company.id, expenseParams, tx, { userId: randomUUID(), canSeeAll: false })).length, 0);
      console.log("PASS expense archive ownership restrictions");

      const [ledger] = await tx.execute<{ quantity: string }>(sql`
        select coalesce(sum(case when l.to_location_id = ${location.id} then l.quantity else -l.quantity end), 0)::text as quantity
        from stock_movement_lines l inner join stock_movements m on m.id = l.stock_movement_id
        where l.product_id = ${reserved.product.id} and m.status = 'posted' and m.deleted_at is null and l.deleted_at is null
      `);
      assert.equal(Number(ledger.quantity), -reserved.qty);
      console.log("PASS reversal ledger keeps original movements and balances net correctly");
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
    console.log("Archive integration checks passed; all fixtures rolled back.");
  } finally {
    await client.end();
  }
}

void main().catch((error) => { console.error(error); process.exitCode = 1; });
