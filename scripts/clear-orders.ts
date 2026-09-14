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
  console.log("=== Starting Order Removal & Stock Reversal ===");

  await db.transaction(async (tx) => {
    // 1. Release all stock reservations first to clear reserved quantities
    console.log("1. Releasing and deleting all stock reservations...");
    await tx.execute(sql`DELETE FROM stock_reservations;`);

    // 2. Reset quantity_reserved to 0 so that quantity_available = quantity_on_hand
    console.log("2. Resetting reserved stock to 0 on all stock balances...");
    await tx.execute(sql`
      UPDATE stock_balances
      SET 
        quantity_reserved = 0,
        quantity_available = quantity_on_hand,
        updated_at = NOW();
    `);

    // 3. Find stock movements from purchase goods receipts and reverse stock balances
    console.log("3. Finding stock movements from purchase goods receipts...");
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
        SELECT stock_movement_id FROM goods_receipts WHERE stock_movement_id IS NOT NULL
      );
    `);

    console.log(`Found ${linesToReverse.length} receipt lines to reverse.`);

    for (const line of linesToReverse as any[]) {
      const qty = Number(line.quantity);
      console.log(`   Reversing ${qty} units of ${line.sku} (${line.product_name}) from location ${line.to_location_id}, owner ${line.owner_id}`);

      await tx.execute(sql`
        UPDATE stock_balances
        SET 
          quantity_on_hand = GREATEST(0, quantity_on_hand - ${qty}),
          quantity_available = GREATEST(0, quantity_on_hand - ${qty}),
          updated_at = NOW(),
          last_movement_at = NOW()
        WHERE location_id = ${line.to_location_id}
          AND owner_id = ${line.owner_id}
          AND product_id = ${line.product_id};
      `);
    }

    // 4. Collect stock movement IDs before deleting goods receipts and deliveries
    const movementRows = await tx.execute(sql`
      SELECT DISTINCT stock_movement_id
      FROM goods_receipts
      WHERE stock_movement_id IS NOT NULL
      UNION
      SELECT DISTINCT stock_movement_id
      FROM deliveries
      WHERE stock_movement_id IS NOT NULL;
    `);
    const movementIds = (movementRows as any[]).map((r) => r.stock_movement_id);
    console.log(`Found ${movementIds.length} stock movements linked to receipts/deliveries.`);

    // 5. Delete goods receipt lines and goods receipts
    console.log("5. Deleting goods receipts and receipt lines...");
    await tx.execute(sql`DELETE FROM goods_receipt_lines;`);
    await tx.execute(sql`DELETE FROM goods_receipts;`);

    // 6. Delete delivery lines and deliveries
    console.log("6. Deleting sales deliveries and delivery lines...");
    await tx.execute(sql`DELETE FROM delivery_lines;`);
    await tx.execute(sql`DELETE FROM deliveries;`);

    // 7. Delete stock movement lines and movements associated with those receipts/deliveries
    if (movementIds.length > 0) {
      console.log(`7. Deleting ${movementIds.length} stock movements and their lines...`);
      for (const mid of movementIds) {
        await tx.execute(sql`DELETE FROM stock_movement_lines WHERE stock_movement_id = ${mid};`);
        await tx.execute(sql`DELETE FROM stock_movements WHERE id = ${mid};`);
      }
    }

    // 8. Delete vendor bills & supplier bill placeholders (if any)
    console.log("8. Deleting vendor bills and placeholders...");
    await tx.execute(sql`DELETE FROM vendor_bill_lines;`);
    await tx.execute(sql`DELETE FROM vendor_bills;`);
    await tx.execute(sql`DELETE FROM supplier_bill_placeholders;`);

    // 9. Delete purchase orders and lines
    console.log("9. Deleting purchase orders and lines...");
    await tx.execute(sql`DELETE FROM purchase_order_lines;`);
    await tx.execute(sql`DELETE FROM purchase_orders;`);

    // 10. Delete customer returns and invoices (if any)
    console.log("10. Deleting customer returns and invoices...");
    await tx.execute(sql`DELETE FROM customer_return_lines;`);
    await tx.execute(sql`DELETE FROM customer_returns;`);
    await tx.execute(sql`DELETE FROM customer_invoice_lines;`);
    await tx.execute(sql`DELETE FROM customer_invoices;`);

    // 11. Delete sales order lines and sales orders
    console.log("11. Deleting sales orders and sales order lines...");
    await tx.execute(sql`DELETE FROM sales_order_lines;`);
    await tx.execute(sql`DELETE FROM sales_orders;`);

    // 12. Final sync of stock balances to ensure complete consistency
    console.log("12. Final stock balance sync...");
    await tx.execute(sql`
      UPDATE stock_balances
      SET 
        quantity_reserved = 0,
        quantity_available = quantity_on_hand,
        updated_at = NOW();
    `);

    console.log("=== All Sales & Purchase Orders Removed and Stock Reversed Successfully! ===");
  });
}

main()
  .then(() => {
    console.log("Completed successfully.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Error during order removal:", err);
    process.exit(1);
  });
