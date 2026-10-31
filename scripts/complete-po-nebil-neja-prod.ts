import postgres from "postgres";

const NEON_PROD_URL =
  process.env.PROD_DATABASE_URL ||
  process.env.DATABASE_URL ||
  "";

if (!NEON_PROD_URL) {
  throw new Error("PROD_DATABASE_URL or DATABASE_URL environment variable is required.");
}

interface NewItem {
  sheetLine: number;
  name: string;
  qty: number;
  unitPrice: number;
}

// Lines 5 to 37 from the sheet (items after the first 4 scales)
const REMAINING_ITEMS: NewItem[] = [
  { sheetLine: 6, name: "PERSONAL SCALE", qty: 50, unitPrice: 1800 },
  { sheetLine: 7, name: "CONTINIUS BAND SEALER", qty: 5, unitPrice: 53000 },
  { sheetLine: 8, name: "OIL PRESS MACHINE", qty: 10, unitPrice: 60000 },
  { sheetLine: 9, name: "TRIMMER EDON 520/3000W", qty: 20, unitPrice: 19000 },
  { sheetLine: 10, name: "SLIDING DOOR MOTER", qty: 20, unitPrice: 62000 },
  { sheetLine: 11, name: "ASPHALT CUTTER 350MM", qty: 10, unitPrice: 4000 },
  { sheetLine: 12, name: "ASPHALT CUTTER 400MM", qty: 10, unitPrice: 4500 },
  { sheetLine: 13, name: "ASPHALT CUTTER 450MM", qty: 10, unitPrice: 6600 },
  { sheetLine: 14, name: "CORE DRILL 250MM", qty: 5, unitPrice: 50000 },
  { sheetLine: 15, name: "CORE BIT 52MM", qty: 4, unitPrice: 6000 },
  { sheetLine: 16, name: "CORE BIT 76MM", qty: 4, unitPrice: 7000 },
  { sheetLine: 17, name: "CORE BIT 112MM", qty: 4, unitPrice: 9000 },
  { sheetLine: 18, name: "TYRE CHANGER", qty: 3, unitPrice: 160000 },
  { sheetLine: 19, name: "STEEM CLEANER", qty: 5, unitPrice: 29000 },
  { sheetLine: 20, name: "DEEP WATER METER 200M", qty: 5, unitPrice: 100000 },
  { sheetLine: 21, name: "DEEP WATER METER 300M", qty: 5, unitPrice: 120000 },
  { sheetLine: 22, name: "MANUWAL BLOWER 2.5\"", qty: 18, unitPrice: 7000 },
  { sheetLine: 23, name: "CARBON", qty: 300, unitPrice: 450 },
  { sheetLine: 24, name: "CRAIN SCALE 3T", qty: 5, unitPrice: 36000 },
  { sheetLine: 25, name: "CODE PRINTING", qty: 10, unitPrice: 57000 },
  { sheetLine: 26, name: "CODE PRINTING INK", qty: 5, unitPrice: 14000 },
  { sheetLine: 27, name: "WATER QUALITY PH TESTER", qty: 20, unitPrice: 5000 },
  { sheetLine: 28, name: "TERMOMETER", qty: 20, unitPrice: 1200 },
  { sheetLine: 29, name: "TERMOMETER 2IN1", qty: 20, unitPrice: 1800 },
  { sheetLine: 30, name: "LAVEL 3M", qty: 20, unitPrice: 2500 },
  { sheetLine: 31, name: "LAVEL 5M", qty: 20, unitPrice: 3000 },
  { sheetLine: 32, name: "INCLINO METER", qty: 20, unitPrice: 3000 },
  { sheetLine: 33, name: "ANGEL RULLER", qty: 20, unitPrice: 3000 },
  { sheetLine: 34, name: "GOLD TESTER", qty: 2, unitPrice: 5500 },
  { sheetLine: 35, name: "GOLD TESTER LENS", qty: 20, unitPrice: 2500 },
  { sheetLine: 36, name: "MOISTURE TESTER", qty: 10, unitPrice: 5500 },
  { sheetLine: 37, name: "SOIL TESTER", qty: 20, unitPrice: 3000 },
  { sheetLine: 38, name: "CABLE SLIDER", qty: 1, unitPrice: 35000 },
];

async function main() {
  const isCommit = process.argv.includes("--commit");
  console.log(`\n=== Completing PO/00193/2026 on Production Database ===`);
  console.log(`Mode: ${isCommit ? "🚨 LIVE COMMIT TO PRODUCTION" : "🔍 DRY RUN (Rollback, zero changes)"}\n`);

  const sql = postgres(NEON_PROD_URL, { max: 1 });

  try {
    const PO_ID = "61111028-b1bf-4423-8182-5f27afdd7cce";

    // 1. Fetch PO
    const [po] = await sql<{
      id: string;
      order_no: string;
      company_id: string;
      owner_id: string;
      deliver_to_location_id: string;
      currency_code: string;
      status: string;
    }[]>`
      select id, order_no, company_id, owner_id, deliver_to_location_id, currency_code, status
      from purchase_orders
      where id = ${PO_ID}
    `;
    if (!po) throw new Error("PO/00193/2026 not found in production!");
    console.log(`Found PO: ${po.order_no} (${po.id})`);

    // 2. Fetch Goods Receipt & Movement
    const [gr] = await sql<{ id: string; receipt_no: string; stock_movement_id: string }[]>`
      select id, receipt_no, stock_movement_id
      from goods_receipts
      where purchase_order_id = ${po.id}
      limit 1
    `;
    if (!gr) throw new Error("Goods receipt for PO/00193/2026 not found!");
    console.log(`Found Goods Receipt: ${gr.receipt_no} (${gr.id})`);

    const [sm] = await sql<{ id: string; from_location_id: string; to_location_id: string }[]>`
      select id, from_location_id, to_location_id
      from stock_movements
      where id = ${gr.stock_movement_id}
      limit 1
    `;
    if (!sm) throw new Error("Stock movement not found!");

    // 3. Fetch default unit (Pcs)
    const [unit] = await sql<{ id: string; code: string }[]>`
      select id, code from units_of_measure where id = '18d31550-9815-4d45-9d28-2785efddb047'
    `;
    if (!unit) throw new Error("Unit UOM-0001 (Pcs) not found!");

    await sql.begin(async (tx) => {
      // Step A: Correct Line 4 unit cost to 95,000 ETB (190,000 line total)
      const line4CostMinor = 95000 * 100;
      const line4TotalMinor = 2 * line4CostMinor;

      await tx`
        update purchase_order_lines
        set
          unit_cost_minor = ${line4CostMinor},
          line_total_minor = ${line4TotalMinor},
          updated_at = now()
        where purchase_order_id = ${po.id} and line_no = 4
      `;

      await tx`
        update goods_receipt_lines
        set
          unit_cost_minor = ${line4CostMinor},
          landed_unit_cost_minor = ${line4CostMinor},
          line_total_minor = ${line4TotalMinor},
          updated_at = now()
        where goods_receipt_id = ${gr.id} and line_no = 4
      `;

      await tx`
        update stock_movement_lines
        set
          total_cost_minor = ${line4TotalMinor},
          updated_at = now()
        where stock_movement_id = ${sm.id} and line_no = 4
      `;
      console.log(`✓ Line 4 (Digital Scale 3Ton) corrected to 95,000 ETB (Total: 190,000 ETB)`);

      // Step B: Calculate next SKU number
      const [maxSkuRow] = await tx<{ maxNum: number }[]>`
        select coalesce(max(substring(sku from '[0-9]+')::int), 305) as "maxNum"
        from products
        where company_id = ${po.company_id} and sku ~ '^ITEM-[0-9]+'
      `;
      let nextSkuNum = (maxSkuRow?.maxNum ?? 305) + 1;
      console.log(`Starting next SKU sequence from: ITEM-${String(nextSkuNum).padStart(5, "0")}`);

      // Step C: Process remaining 33 items
      let poLineNo = 5;
      let grLineNo = 5;
      let totalRemainingMinor = 0;

      for (const item of REMAINING_ITEMS) {
        const itemCostMinor = item.unitPrice * 100;
        const lineTotalMinor = item.qty * itemCostMinor;
        totalRemainingMinor += lineTotalMinor;

        // Check if product exists (e.g. tyre changer or by name)
        let [prod] = await tx<{ id: string; sku: string; name: string }[]>`
          select id, sku, name from products
          where company_id = ${po.company_id}
            and (lower(name) = lower(${item.name}) or (lower(${item.name}) = 'tyre changer' and sku = 'ITEM-00276'))
            and deleted_at is null
          limit 1
        `;

        if (!prod) {
          const sku = `ITEM-${String(nextSkuNum++).padStart(5, "0")}`;
          [prod] = await tx<{ id: string; sku: string; name: string }[]>`
            insert into products (
              company_id,
              sku,
              name,
              unit_id,
              tracking_mode,
              standard_cost_minor,
              list_price_minor,
              currency_code,
              is_active
            )
            values (
              ${po.company_id},
              ${sku},
              ${item.name},
              ${unit.id},
              'none',
              ${itemCostMinor},
              ${itemCostMinor},
              ${po.currency_code},
              true
            )
            returning id, sku, name
          `;
          console.log(`  + [NEW] [${prod.sku}] ${prod.name}`);
        } else {
          console.log(`  = [EXISTING] [${prod.sku}] ${prod.name}`);
        }

        // Add line to PO
        const [poLine] = await tx<{ id: string }[]>`
          insert into purchase_order_lines (
            purchase_order_id,
            line_no,
            product_id,
            owner_id,
            description,
            unit_id,
            quantity_ordered,
            quantity_received,
            unit_cost_minor,
            tax_amount_minor,
            line_total_minor,
            currency_code
          )
          values (
            ${po.id},
            ${poLineNo++},
            ${prod.id},
            ${po.owner_id},
            ${item.name},
            ${unit.id},
            ${item.qty},
            ${item.qty},
            ${itemCostMinor},
            0,
            ${lineTotalMinor},
            ${po.currency_code}
          )
          returning id
        `;

        // Add line to Goods Receipt
        await tx`
          insert into goods_receipt_lines (
            goods_receipt_id,
            purchase_order_line_id,
            line_no,
            product_id,
            unit_id,
            quantity_received,
            unit_cost_minor,
            landed_unit_cost_minor,
            line_total_minor,
            currency_code
          )
          values (
            ${gr.id},
            ${poLine.id},
            ${grLineNo++},
            ${prod.id},
            ${unit.id},
            ${item.qty},
            ${itemCostMinor},
            ${itemCostMinor},
            ${lineTotalMinor},
            ${po.currency_code}
          )
        `;

        // Add line to Stock Movement
        await tx`
          insert into stock_movement_lines (
            stock_movement_id,
            line_no,
            product_id,
            from_location_id,
            to_location_id,
            unit_id,
            quantity,
            total_cost_minor,
            currency_code,
            owner_id,
            notes
          )
          values (
            ${sm.id},
            ${grLineNo - 1},
            ${prod.id},
            ${sm.from_location_id},
            ${sm.to_location_id},
            ${unit.id},
            ${item.qty},
            ${lineTotalMinor},
            ${po.currency_code},
            ${po.owner_id},
            ${`Received from ${po.order_no}`}
          )
        `;

        // Upsert stock balance in Main Display Shop
        const [balance] = await tx<{ id: string; quantity_on_hand: string; quantity_reserved: string }[]>`
          select id, quantity_on_hand, quantity_reserved
          from stock_balances
          where company_id = ${po.company_id}
            and location_id = ${po.deliver_to_location_id}
            and product_id = ${prod.id}
            and owner_id = ${po.owner_id}
            and product_serial_id is null
            and product_lot_id is null
            and deleted_at is null
          limit 1
        `;

        if (balance) {
          const nextOnHand = Number(balance.quantity_on_hand) + item.qty;
          const nextAvailable = nextOnHand - Number(balance.quantity_reserved);
          await tx`
            update stock_balances
            set
              quantity_on_hand = ${nextOnHand},
              quantity_available = ${nextAvailable},
              average_cost_minor = ${itemCostMinor},
              last_movement_at = now(),
              updated_at = now()
            where id = ${balance.id}
          `;
        } else {
          await tx`
            insert into stock_balances (
              company_id,
              location_id,
              product_id,
              owner_id,
              quantity_on_hand,
              quantity_reserved,
              quantity_available,
              average_cost_minor,
              currency_code,
              last_movement_at,
              created_at,
              updated_at
            )
            values (
              ${po.company_id},
              ${po.deliver_to_location_id},
              ${prod.id},
              ${po.owner_id},
              ${item.qty},
              0,
              ${item.qty},
              ${itemCostMinor},
              ${po.currency_code},
              now(),
              now(),
              now()
            )
          `;
        }
      }

      // Step D: Update Purchase Order header totals to exact 7,214,000 ETB
      const GRAND_TOTAL_MINOR = 7214000 * 100; // 7,214,000 ETB
      await tx`
        update purchase_orders
        set
          subtotal_minor = ${GRAND_TOTAL_MINOR},
          total_minor = ${GRAND_TOTAL_MINOR},
          status = 'received',
          notes = 'Completed full 37 lines from Nebil Neja purchase sheet dated Oct 8, 2026',
          updated_at = now()
        where id = ${po.id}
      `;

      console.log(`\n✓ Purchase Order updated to 37 lines, Total: 7,214,000 ETB`);
      console.log(`✓ Goods Receipt & Stock Movement updated to 37 lines`);
      console.log(`✓ Stock balances increased for all 37 products`);
      console.log(`✓ No payment recorded (as requested)`);

      if (!isCommit) {
        console.log(`\n[DRY RUN] Rolling back cleanly. Database untouched.`);
        throw new Error("__ROLLBACK__");
      }
    });

    if (isCommit) {
      console.log(`\n🎉 Success! PO/00193/2026 completed in production database.`);
    }
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "__ROLLBACK__") {
      console.log("Dry run finished successfully with ZERO changes committed.\n");
      return;
    }
    console.error("Execution error:", err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();
