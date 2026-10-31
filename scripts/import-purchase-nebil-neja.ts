import "dotenv/config";

import postgres from "postgres";

const dbUrlArg = process.argv.find((arg) => arg.startsWith("--db-url="))?.split("=")[1];
const databaseUrl = dbUrlArg || process.env.PROD_DATABASE_URL || process.env.DATABASE_URL || "";

if (!databaseUrl) {
  throw new Error("A database connection string is required. Provide it via DATABASE_URL or --db-url='postgres://...'");
}

export interface PurchaseItem {
  name: string;
  sku: string;
  qty: number;
  unitPrice: number; // in ETB major units
}

export const PURCHASE_ITEMS: PurchaseItem[] = [
  { name: "SCALE 500KG", sku: "SCALE-500KG", qty: 5, unitPrice: 22000 },
  { name: "SCALE 1000KG", sku: "SCALE-1000KG", qty: 2, unitPrice: 54000 },
  { name: "SCALE 1000KG (1M*1M)", sku: "SCALE-1000KG-1M1M", qty: 5, unitPrice: 67000 },
  { name: "SCALE 3T", sku: "SCALE-3T", qty: 2, unitPrice: 95000 },
  { name: "PERSONAL SCALE", sku: "SCALE-PERSONAL", qty: 50, unitPrice: 1800 },
  { name: "CONTINIUS BAND SEALER", sku: "SEALER-BAND-CONT", qty: 5, unitPrice: 53000 },
  { name: "OIL PRESS MACHINE", sku: "MACH-OIL-PRESS", qty: 10, unitPrice: 60000 },
  { name: "TRIMMER EDON 520/3000W", sku: "TRIMMER-EDON-520-3000W", qty: 20, unitPrice: 19000 },
  { name: "SLIDING DOOR MOTER", sku: "MOTOR-SLIDING-DOOR", qty: 20, unitPrice: 62000 },
  { name: "ASPHALT CUTTER 350MM", sku: "CUTTER-ASPHALT-350MM", qty: 10, unitPrice: 4000 },
  { name: "ASPHALT CUTTER 400MM", sku: "CUTTER-ASPHALT-400MM", qty: 10, unitPrice: 4500 },
  { name: "ASPHALT CUTTER 450MM", sku: "CUTTER-ASPHALT-450MM", qty: 10, unitPrice: 6600 },
  { name: "CORE DRILL 250MM", sku: "DRILL-CORE-250MM", qty: 5, unitPrice: 50000 },
  { name: "CORE BIT 52MM", sku: "BIT-CORE-52MM", qty: 4, unitPrice: 6000 },
  { name: "CORE BIT 76MM", sku: "BIT-CORE-76MM", qty: 4, unitPrice: 7000 },
  { name: "CORE BIT 112MM", sku: "BIT-CORE-112MM", qty: 4, unitPrice: 9000 },
  { name: "TYRE CHANGER", sku: "EQUIP-TYRE-CHANGER", qty: 3, unitPrice: 160000 },
  { name: "STEEM CLEANER", sku: "EQUIP-STEAM-CLEANER", qty: 5, unitPrice: 29000 },
  { name: "DEEP WATER METER 200M", sku: "METER-WATER-DEEP-200M", qty: 5, unitPrice: 100000 },
  { name: "DEEP WATER METER 300M", sku: "METER-WATER-DEEP-300M", qty: 5, unitPrice: 120000 },
  { name: "MANUWAL BLOWER 2.5\"", sku: "BLOWER-MANUAL-2.5IN", qty: 18, unitPrice: 7000 },
  { name: "CARBON", sku: "MAT-CARBON", qty: 300, unitPrice: 450 },
  { name: "CRAIN SCALE 3T", sku: "SCALE-CRANE-3T", qty: 5, unitPrice: 36000 },
  { name: "CODE PRINTING", sku: "EQUIP-CODE-PRINTING", qty: 10, unitPrice: 57000 },
  { name: "CODE PRINTING INK", sku: "INK-CODE-PRINTING", qty: 5, unitPrice: 14000 },
  { name: "WATER QUALITY PH TESTER", sku: "TESTER-PH-WATER", qty: 20, unitPrice: 5000 },
  { name: "TERMOMETER", sku: "METER-THERMOMETER", qty: 20, unitPrice: 1200 },
  { name: "TERMOMETER 2IN1", sku: "METER-THERMOMETER-2IN1", qty: 20, unitPrice: 1800 },
  { name: "LAVEL 3M", sku: "TOOL-LEVEL-3M", qty: 20, unitPrice: 2500 },
  { name: "LAVEL 5M", sku: "TOOL-LEVEL-5M", qty: 20, unitPrice: 3000 },
  { name: "INCLINO METER", sku: "METER-INCLINOMETER", qty: 20, unitPrice: 3000 },
  { name: "ANGEL RULLER", sku: "TOOL-ANGLE-RULER", qty: 20, unitPrice: 3000 },
  { name: "GOLD TESTER", sku: "TESTER-GOLD", qty: 2, unitPrice: 5500 },
  { name: "GOLD TESTER LENS", sku: "LENS-GOLD-TESTER", qty: 20, unitPrice: 2500 },
  { name: "MOISTURE TESTER", sku: "TESTER-MOISTURE", qty: 10, unitPrice: 5500 },
  { name: "SOIL TESTER", sku: "TESTER-SOIL", qty: 20, unitPrice: 3000 },
  { name: "CABLE SLIDER", sku: "TOOL-CABLE-SLIDER", qty: 1, unitPrice: 35000 },
];

async function run() {
  const isCommit = process.argv.includes("--commit");
  const receiveStock = process.argv.includes("--receive");
  const recordPayment = process.argv.includes("--pay-awash");

  console.log(`\n=== Nebil Neja Purchase Import Script ===`);
  console.log(`Mode: ${isCommit ? "COMMIT (Live DB update)" : "DRY-RUN (Validation only, will roll back)"}`);
  console.log(`Receive Goods into Warehouse: ${receiveStock ? "YES" : "NO (PO only)"}`);
  console.log(`Record Awash Bank Payment (200,000 ETB): ${recordPayment ? "YES" : "NO"}\n`);

  const sql = postgres(databaseUrl, { max: 1 });

  try {
    const [company] = await sql<{ id: string; base_currency_code: string }[]>`
      select id, base_currency_code from companies where deleted_at is null order by created_at asc limit 1
    `;
    if (!company) throw new Error("Company not found.");

    let [adminUser] = await sql<{ id: string; username: string }[]>`
      select id, username from users where company_id = ${company.id} and username in ('admin', 'mesud') and deleted_at is null limit 1
    `;
    if (!adminUser) {
      [adminUser] = await sql<{ id: string; username: string }[]>`
        select id, username from users where company_id = ${company.id} and deleted_at is null order by created_at asc limit 1
      `;
    }
    if (!adminUser) throw new Error("No active user found in database.");

    const [owner] = await sql<{ id: string; name: string }[]>`
      select id, name from owners where company_id = ${company.id} and deleted_at is null order by created_at asc limit 1
    `;
    if (!owner) throw new Error("No active owner found in database.");

    const [warehouse] = await sql<{ id: string; code: string; name: string }[]>`
      select id, code, name from locations where company_id = ${company.id} and location_type = 'warehouse' and is_active = true and deleted_at is null order by created_at asc limit 1
    `;
    if (!warehouse) throw new Error("Warehouse location not found.");

    let [unit] = await sql<{ id: string; code: string }[]>`
      select id, code from units_of_measure where company_id = ${company.id} and (code in ('EA', 'PCS', 'UNIT') or name in ('Each', 'Piece', 'Unit')) and deleted_at is null limit 1
    `;
    if (!unit) {
      [unit] = await sql<{ id: string; code: string }[]>`
        select id, code from units_of_measure where company_id = ${company.id} and deleted_at is null order by created_at asc limit 1
      `;
    }
    if (!unit) throw new Error("Unit of measure not found.");

    // Calculate total
    let totalMinor = 0;
    for (const item of PURCHASE_ITEMS) {
      totalMinor += item.qty * (item.unitPrice * 100);
    }
    console.log(`Total line items: ${PURCHASE_ITEMS.length}`);
    console.log(`Calculated Total: ${(totalMinor / 100).toLocaleString()} ETB (${totalMinor} cents)\n`);

    await sql.begin(async (tx) => {
      // 1. Ensure Supplier
      let [supplier] = await tx<{ id: string; display_name: string }[]>`
        select id, display_name from partners
        where company_id = ${company.id}
          and (display_name ilike 'Nebil Neja%' or code = 'SUP-NEBIL-NEJA')
          and deleted_at is null
        limit 1
      `;

      if (!supplier) {
        [supplier] = await tx<{ id: string; display_name: string }[]>`
          insert into partners (
            company_id,
            code,
            display_name,
            legal_name,
            is_customer,
            is_supplier,
            credit_limit_minor,
            currency_code,
            status,
            notes
          )
          values (
            ${company.id},
            'SUP-NEBIL-NEJA',
            'Nebil Neja',
            'Nebil Neja',
            false,
            true,
            0,
            ${company.base_currency_code},
            'active',
            'Imported supplier from Oct 8 purchase'
          )
          returning id, display_name
        `;
        console.log(`+ Created Supplier: ${supplier.display_name} (${supplier.id})`);
      } else {
        console.log(`= Existing Supplier found: ${supplier.display_name} (${supplier.id})`);
      }

      // 2. Ensure Products
      const productMap = new Map<string, { id: string; sku: string; name: string }>();
      for (const item of PURCHASE_ITEMS) {
        const unitCostMinor = item.unitPrice * 100;
        let [prod] = await tx<{ id: string; sku: string; name: string }[]>`
          select id, sku, name from products
          where company_id = ${company.id}
            and (sku = ${item.sku} or name = ${item.name})
            and deleted_at is null
          limit 1
        `;

        if (!prod) {
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
              ${company.id},
              ${item.sku},
              ${item.name},
              ${unit.id},
              'none',
              ${unitCostMinor},
              ${unitCostMinor}, -- Default list price = cost, editable later
              ${company.base_currency_code},
              true
            )
            returning id, sku, name
          `;
          console.log(`  + Created Product: [${prod.sku}] ${prod.name}`);
        } else {
          console.log(`  = Found Product: [${prod.sku}] ${prod.name}`);
        }
        productMap.set(item.name, prod);
      }

      // 3. Generate PO Number
      const year = "2026";
      const [poRow] = await tx<{ maxNo: number }[]>`
        select coalesce(max((substring(order_no from '^PO/([0-9]{5})/2026$'))::int), 0) + 1 as "maxNo"
        from purchase_orders
        where company_id = ${company.id} and deleted_at is null
      `;
      const poNumber = `PO/${String(poRow?.maxNo ?? 1).padStart(5, "0")}/${year}`;

      // 4. Create Purchase Order
      const orderDate = "2026-10-08";
      const poStatus = receiveStock ? "received" : "confirmed";

      const [purchaseOrder] = await tx<{ id: string; order_no: string }[]>`
        insert into purchase_orders (
          company_id,
          supplier_id,
          owner_id,
          deliver_to_location_id,
          order_no,
          vendor_reference,
          payment_term,
          status,
          order_date,
          currency_code,
          subtotal_minor,
          landed_cost_estimate_minor,
          tax_amount_minor,
          total_minor,
          created_by,
          notes
        )
        values (
          ${company.id},
          ${supplier.id},
          ${owner.id},
          ${warehouse.id},
          ${poNumber},
          'Nebil Neja Oct 8',
          'credit',
          ${poStatus},
          ${orderDate},
          ${company.base_currency_code},
          ${totalMinor},
          0,
          0,
          ${totalMinor},
          ${adminUser.id},
          'Imported purchase order from Excel sheet dated Oct 8, 2026'
        )
        returning id, order_no
      `;
      console.log(`\n+ Created Purchase Order: ${purchaseOrder.order_no} (${purchaseOrder.id}) [Status: ${poStatus}]`);

      // 5. Create PO Lines
      let lineNo = 1;
      const createdLineIds: { id: string; productId: string; qty: number; unitCostMinor: number }[] = [];
      for (const item of PURCHASE_ITEMS) {
        const prod = productMap.get(item.name)!;
        const lineUnitCostMinor = item.unitPrice * 100;
        const lineTotalMinor = item.qty * lineUnitCostMinor;

        const [line] = await tx<{ id: string }[]>`
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
            ${purchaseOrder.id},
            ${lineNo++},
            ${prod.id},
            ${owner.id},
            ${item.name},
            ${unit.id},
            ${item.qty},
            ${receiveStock ? item.qty : 0},
            ${lineUnitCostMinor},
            0,
            ${lineTotalMinor},
            ${company.base_currency_code}
          )
          returning id
        `;
        createdLineIds.push({ id: line.id, productId: prod.id, qty: item.qty, unitCostMinor: lineUnitCostMinor });
      }
      console.log(`+ Added ${createdLineIds.length} PO lines.`);

      // 6. Optional: Goods Receipt & Stock Movement
      if (receiveStock) {
        // Supplier virtual location
        let [supplierLoc] = await tx<{ id: string }[]>`
          select id from locations where company_id = ${company.id} and code = 'VENDORS' limit 1
        `;
        if (!supplierLoc) {
          [supplierLoc] = await tx<{ id: string }[]>`
            insert into locations (company_id, code, name, location_type, offline_sales_enabled, allow_negative_stock, is_active)
            values (${company.id}, 'VENDORS', 'Vendor Location', 'supplier', false, false, true)
            returning id
          `;
        }

        const [smRow] = await tx<{ maxNo: number }[]>`
          select coalesce(max((substring(movement_no from '^PR/([0-9]{5})/2026$'))::int), 0) + 1 as "maxNo"
          from stock_movements
          where company_id = ${company.id} and deleted_at is null
        `;
        const movementNo = `PR/${String(smRow?.maxNo ?? 1).padStart(5, "0")}/${year}`;

        const [grRow] = await tx<{ maxNo: number }[]>`
          select coalesce(max((substring(receipt_no from '^GR/([0-9]{5})/2026$'))::int), 0) + 1 as "maxNo"
          from goods_receipts
          where company_id = ${company.id} and deleted_at is null
        `;
        const receiptNo = `GR/${String(grRow?.maxNo ?? 1).padStart(5, "0")}/${year}`;

        const [receipt] = await tx<{ id: string; receipt_no: string }[]>`
          insert into goods_receipts (
            company_id,
            purchase_order_id,
            supplier_id,
            location_id,
            receipt_no,
            status,
            receipt_date,
            posted_at,
            posted_by,
            notes
          )
          values (
            ${company.id},
            ${purchaseOrder.id},
            ${supplier.id},
            ${warehouse.id},
            ${receiptNo},
            'posted',
            '2026-10-08T00:00:00Z',
            now(),
            ${adminUser.id},
            'Auto-received stock to warehouse from Oct 8 purchase'
          )
          returning id, receipt_no
        `;
        console.log(`+ Created & Posted Goods Receipt: ${receipt.receipt_no}`);

        const [movement] = await tx<{ id: string }[]>`
          insert into stock_movements (
            company_id,
            movement_no,
            movement_type,
            status,
            from_location_id,
            to_location_id,
            source_type,
            source_id,
            source_no,
            owner_id,
            posted_at,
            posted_by,
            notes,
            created_at
          )
          values (
            ${company.id},
            ${movementNo},
            'purchase_receipt',
            'posted',
            ${supplierLoc.id},
            ${warehouse.id},
            'goods_receipt',
            ${receipt.id},
            ${receipt.receipt_no},
            ${owner.id},
            now(),
            ${adminUser.id},
            ${`Goods receipt for ${purchaseOrder.order_no}`},
            now()
          )
          returning id
        `;

        await tx`
          update goods_receipts
          set stock_movement_id = ${movement.id}
          where id = ${receipt.id}
        `;

        let grLineNo = 1;
        for (const line of createdLineIds) {
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
              ${receipt.id},
              ${line.id},
              ${grLineNo++},
              ${line.productId},
              ${unit.id},
              ${line.qty},
              ${line.unitCostMinor},
              ${line.unitCostMinor},
              ${line.qty * line.unitCostMinor},
              ${company.base_currency_code}
            )
          `;

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
              owner_id
            )
            values (
              ${movement.id},
              ${grLineNo - 1},
              ${line.productId},
              ${supplierLoc.id},
              ${warehouse.id},
              ${unit.id},
              ${line.qty},
              ${line.qty * line.unitCostMinor},
              ${company.base_currency_code},
              ${owner.id}
            )
          `;

          // Upsert stock balance
          const [balance] = await tx<{ id: string; quantity_on_hand: string; quantity_reserved: string }[]>`
            select id, quantity_on_hand, quantity_reserved
            from stock_balances
            where company_id = ${company.id}
              and location_id = ${warehouse.id}
              and product_id = ${line.productId}
              and owner_id = ${owner.id}
              and product_serial_id is null
              and product_lot_id is null
              and deleted_at is null
            limit 1
          `;

          if (balance) {
            const nextOnHand = Number(balance.quantity_on_hand) + line.qty;
            const nextAvailable = nextOnHand - Number(balance.quantity_reserved);
            await tx`
              update stock_balances
              set
                quantity_on_hand = ${nextOnHand},
                quantity_available = ${nextAvailable},
                average_cost_minor = ${line.unitCostMinor},
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
                ${company.id},
                ${warehouse.id},
                ${line.productId},
                ${owner.id},
                ${line.qty},
                0,
                ${line.qty},
                ${line.unitCostMinor},
                ${company.base_currency_code},
                now(),
                now(),
                now()
              )
            `;
          }
        }
        console.log(`+ Stock balances updated for all 37 products in warehouse ${warehouse.name}`);
      }

      // 7. Optional: Awash Bank partial payment
      if (recordPayment) {
        const [awashAccount] = await tx<{ id: string; payment_method_id: string; name: string }[]>`
          select id, payment_method_id, name from payment_accounts
          where company_id = ${company.id}
            and (code ilike '%awash%' or name ilike '%awash%' or institution_name ilike '%awash%')
            and deleted_at is null
          limit 1
        `;
        if (awashAccount) {
          const paymentAmountMinor = 200000 * 100; // 200,000 ETB
          const [payment] = await tx<{ id: string; payment_no: string }[]>`
            insert into payments (
              company_id,
              payment_no,
              partner_id,
              payment_method_id,
              payment_account_id,
              payment_type,
              status,
              amount_minor,
              currency_code,
              payment_date,
              reference,
              notes,
              posted_at,
              posted_by
            )
            values (
              ${company.id},
              ${`PAY-SUP-AWASH-${Date.now().toString().slice(-6)}`},
              ${supplier.id},
              ${awashAccount.payment_method_id},
              ${awashAccount.id},
              'outbound',
              'posted',
              ${paymentAmountMinor},
              ${company.base_currency_code},
              '2026-10-09T00:00:00Z',
              'Awash Bank Transfer',
              'Partial payment for purchase order on Oct 9, 2026',
              now(),
              ${adminUser.id}
            )
            returning id, payment_no
          `;

          await tx`
            insert into payment_allocations (
              payment_id,
              purchase_order_id,
              amount_minor
            )
            values (
              ${payment.id},
              ${purchaseOrder.id},
              ${paymentAmountMinor}
            )
          `;
          console.log(`+ Recorded Awash Bank Payment: ${payment.payment_no} (200,000 ETB via ${awashAccount.name}) allocated to PO`);
        } else {
          console.log(`! Awash Bank account not found in DB, skipped payment creation.`);
        }
      }

      if (!isCommit) {
        console.log(`\n[DRY RUN COMPLETE] Rolling back all changes cleanly.`);
        throw new Error("__ROLLBACK__");
      }
    });

    if (isCommit) {
      console.log(`\n🎉 Success! All data committed to database.`);
    }
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "__ROLLBACK__") {
      console.log("Database remained untouched (dry-run mode).\n");
      return;
    }
    console.error("Execution error:", err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

run();
