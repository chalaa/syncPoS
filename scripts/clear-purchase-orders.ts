import "dotenv/config";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";

const databaseUrl = process.env.DATABASE_URL ?? "";
if (!databaseUrl) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const client = postgres(databaseUrl, { max: 1 });
const db = drizzle(client);

async function main() {
  console.log("=== Starting Purchase Orders Clean-up ===");

  await db.transaction(async (tx) => {
    // 1. Find all PO IDs
    const poRows = await tx.execute(sql`SELECT id, order_no FROM purchase_orders;`);
    console.log(`Found ${poRows.length} purchase orders to delete.`);

    if (poRows.length === 0) {
      console.log("No purchase orders found.");
      return;
    }

    // 2. Reverse stock balances from goods receipts linked to purchase orders
    console.log("Reversing stock balances from purchase goods receipts...");
    const linesToReverse = await tx.execute(sql`
      SELECT 
        sml.id,
        sml.owner_id,
        sml.product_id,
        sml.to_location_id,
        sml.quantity,
        p.sku,
        p.name as product_name
      FROM stock_movement_lines sml
      JOIN products p ON p.id = sml.product_id
      WHERE sml.stock_movement_id IN (
        SELECT stock_movement_id 
        FROM goods_receipts 
        WHERE stock_movement_id IS NOT NULL 
          AND purchase_order_id IS NOT NULL
      );
    `);

    for (const line of linesToReverse as any[]) {
      const qty = Number(line.quantity);
      console.log(`   Reversing ${qty} units of ${line.sku} (${line.product_name}) from location ${line.to_location_id}`);
      await tx.execute(sql`
        UPDATE stock_balances
        SET 
          quantity_on_hand = GREATEST(0, quantity_on_hand - ${qty}),
          quantity_available = GREATEST(0, quantity_available - ${qty}),
          updated_at = NOW(),
          last_movement_at = NOW()
        WHERE location_id = ${line.to_location_id}
          AND owner_id = ${line.owner_id}
          AND product_id = ${line.product_id};
      `);
    }

    // 3. Collect stock_movement_ids from goods receipts
    const movementRows = await tx.execute(sql`
      SELECT DISTINCT stock_movement_id
      FROM goods_receipts
      WHERE stock_movement_id IS NOT NULL AND purchase_order_id IS NOT NULL;
    `);
    const movementIds = (movementRows as any[]).map((r) => r.stock_movement_id);

    // 4. Delete goods receipt lines & goods receipts
    console.log("Deleting goods receipt lines and goods receipts...");
    await tx.execute(sql`
      DELETE FROM goods_receipt_lines 
      WHERE goods_receipt_id IN (
        SELECT id FROM goods_receipts WHERE purchase_order_id IS NOT NULL
      );
    `);
    await tx.execute(sql`DELETE FROM goods_receipts WHERE purchase_order_id IS NOT NULL;`);

    // 5. Delete stock movement lines and movements for these receipts
    if (movementIds.length > 0) {
      console.log(`Deleting ${movementIds.length} stock movements and lines...`);
      for (const mid of movementIds) {
        await tx.execute(sql`DELETE FROM stock_movement_lines WHERE stock_movement_id = ${mid};`);
        await tx.execute(sql`DELETE FROM stock_movements WHERE id = ${mid};`);
      }
    }

    // 6. Delete supplier returns & lines (if any)
    console.log("Deleting supplier returns and lines...");
    await tx.execute(sql`
      DELETE FROM supplier_return_lines 
      WHERE supplier_return_id IN (SELECT id FROM supplier_returns WHERE purchase_order_id IS NOT NULL);
    `);
    await tx.execute(sql`DELETE FROM supplier_returns WHERE purchase_order_id IS NOT NULL;`);

    // 7. Delete landed costs & allocations (if any)
    console.log("Deleting landed costs...");
    await tx.execute(sql`
      DELETE FROM landed_cost_allocations 
      WHERE landed_cost_id IN (SELECT id FROM landed_costs WHERE purchase_order_id IS NOT NULL);
    `);
    await tx.execute(sql`DELETE FROM landed_costs WHERE purchase_order_id IS NOT NULL;`);

    // 8. Delete vendor bills & placeholders (if any)
    console.log("Deleting vendor bills and lines...");
    await tx.execute(sql`
      DELETE FROM vendor_bill_lines 
      WHERE vendor_bill_id IN (SELECT id FROM vendor_bills WHERE purchase_order_id IS NOT NULL);
    `);
    await tx.execute(sql`DELETE FROM vendor_bills WHERE purchase_order_id IS NOT NULL;`);
    await tx.execute(sql`DELETE FROM supplier_bill_placeholders WHERE purchase_order_id IS NOT NULL;`);

    // 9. Collect and delete payments & payment lines linked to purchase order allocations
    console.log("Deleting purchase order payment allocations, lines, and payments...");
    const poPayments = await tx.execute(sql`
      SELECT DISTINCT payment_id 
      FROM payment_allocations 
      WHERE purchase_order_id IS NOT NULL;
    `);
    const paymentIds = (poPayments as any[]).map((r) => r.payment_id);

    await tx.execute(sql`DELETE FROM payment_allocations WHERE purchase_order_id IS NOT NULL;`);

    if (paymentIds.length > 0) {
      for (const pid of paymentIds) {
        await tx.execute(sql`DELETE FROM payment_lines WHERE payment_id = ${pid};`);
        const otherAllocs = await tx.execute(sql`
          SELECT count(*)::int as count FROM payment_allocations WHERE payment_id = ${pid};
        `);
        if ((otherAllocs as any[])[0]?.count === 0) {
          await tx.execute(sql`DELETE FROM payments WHERE id = ${pid};`);
        }
      }
    }

    // 10. Delete purchase order taxes & lines & purchase orders
    console.log("Deleting purchase order taxes, lines, and purchase orders...");
    await tx.execute(sql`
      DELETE FROM purchase_order_line_taxes 
      WHERE purchase_order_line_id IN (
        SELECT id FROM purchase_order_lines
      );
    `);
    await tx.execute(sql`DELETE FROM purchase_order_lines;`);
    await tx.execute(sql`DELETE FROM purchase_orders;`);

    // 11. Final sync of stock balances
    console.log("Final stock balance sync...");
    await tx.execute(sql`
      UPDATE stock_balances
      SET 
        quantity_reserved = 0,
        quantity_available = quantity_on_hand,
        updated_at = NOW();
    `);

    console.log("=== All purchase orders deleted and stock reversed successfully! ===");
  });

  await client.end();
}

main().catch((err) => {
  console.error("Error deleting purchase orders:", err);
  process.exit(1);
});
