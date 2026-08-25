import "dotenv/config";

import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL ?? "";

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required.");
}

const quantity = 3;
const unitCostMinor = 120_00;
const subtotalMinor = quantity * unitCostMinor;
const taxAmountMinor = 0;
const totalMinor = subtotalMinor + taxAmountMinor;
const today = new Date().toISOString().slice(0, 10);

function assertCondition(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function testNo(prefix: string) {
  return `${prefix}-${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}`;
}

async function ensureSupplierLocation(sql: postgres.Sql, companyId: string) {
  const [existing] = await sql<{ id: string }[]>`
    select id
    from locations
    where company_id = ${companyId}
      and code = 'VENDORS'
      and deleted_at is null
    limit 1
  `;

  if (existing) {
    await sql`
      update locations
      set location_type = 'supplier', is_active = true, updated_at = now()
      where id = ${existing.id}
    `;

    return existing.id;
  }

  const [created] = await sql<{ id: string }[]>`
    insert into locations (
      company_id,
      code,
      name,
      location_type,
      offline_sales_enabled,
      allow_negative_stock,
      is_active
    )
    values (${companyId}, 'VENDORS', 'Vendor Location', 'supplier', false, false, true)
    returning id
  `;

  assertCondition(created, "Could not create vendor virtual location.");

  return created.id;
}

async function main() {
  const sql = postgres(databaseUrl, { max: 1 });

  try {
    const [company] = await sql<{ id: string; code: string; base_currency_code: string }[]>`
      select id, code, base_currency_code
      from companies
      where deleted_at is null
      order by created_at asc
      limit 1
    `;
    assertCondition(company, "No company found. Run pnpm db:seed first.");

    const [adminUser] = await sql<{ id: string }[]>`
      select id
      from users
      where company_id = ${company.id}
        and username = 'admin'
        and deleted_at is null
      limit 1
    `;
    assertCondition(adminUser, "No admin user found. Run pnpm db:seed first.");

    const [location] = await sql<{ id: string; code: string }[]>`
      select id, code
      from locations
      where company_id = ${company.id}
        and location_type in ('warehouse', 'display_shop')
        and is_active = true
        and deleted_at is null
      order by case when location_type = 'warehouse' then 0 else 1 end, code asc
      limit 1
    `;
    assertCondition(location, "No active receiving location found.");

    const [unit] = await sql<{ id: string }[]>`
      select id
      from units_of_measure
      where company_id = ${company.id}
        and deleted_at is null
      order by created_at asc
      limit 1
    `;
    assertCondition(unit, "No unit of measure found. Create or seed a unit first.");

    const supplierLocationId = await ensureSupplierLocation(sql, company.id);
    const suffix = testNo("FLOW");

    await sql`begin`;

    try {
      const [supplier] = await sql<{ id: string }[]>`
        insert into partners (
          company_id,
          code,
          display_name,
          legal_name,
          is_customer,
          is_supplier,
          credit_limit_minor,
          currency_code,
          status
        )
        values (
          ${company.id},
          ${`SUP-${suffix}`},
          ${`E2E Purchase Supplier ${suffix}`},
          ${`E2E Purchase Supplier ${suffix}`},
          false,
          true,
          0,
          ${company.base_currency_code},
          'active'
        )
        returning id
      `;
      assertCondition(supplier, "Could not create test supplier.");

      const [product] = await sql<{ id: string }[]>`
        insert into products (
          company_id,
          sku,
          name,
          unit_id,
          product_type,
          tracking_mode,
          standard_cost_minor,
          list_price_minor,
          currency_code,
          is_active
        )
        values (
          ${company.id},
          ${`PSKU-${suffix}`},
          ${`E2E Purchase Product ${suffix}`},
          ${unit.id},
          'spare_part',
          'none',
          ${unitCostMinor},
          ${unitCostMinor * 2},
          ${company.base_currency_code},
          true
        )
        returning id
      `;
      assertCondition(product, "Could not create test product.");

      const [purchaseOrder] = await sql<{ id: string }[]>`
        insert into purchase_orders (
          company_id,
          supplier_id,
          deliver_to_location_id,
          order_no,
          vendor_reference,
          status,
          order_date,
          expected_date,
          currency_code,
          subtotal_minor,
          landed_cost_estimate_minor,
          tax_amount_minor,
          total_minor,
          created_by
        )
        values (
          ${company.id},
          ${supplier.id},
          ${location.id},
          ${testNo("PO-E2E")},
          ${`VR-${suffix}`},
          'draft',
          ${today},
          ${today},
          ${company.base_currency_code},
          ${subtotalMinor},
          0,
          ${taxAmountMinor},
          ${totalMinor},
          ${adminUser.id}
        )
        returning id
      `;
      assertCondition(purchaseOrder, "Could not create RFQ.");

      const [purchaseOrderLine] = await sql<{ id: string }[]>`
        insert into purchase_order_lines (
          purchase_order_id,
          line_no,
          product_id,
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
          1,
          ${product.id},
          'E2E purchase line',
          ${unit.id},
          ${quantity},
          0,
          ${unitCostMinor},
          ${taxAmountMinor},
          ${totalMinor},
          ${company.base_currency_code}
        )
        returning id
      `;
      assertCondition(purchaseOrderLine, "Could not create purchase order line.");

      const [draftCheck] = await sql<{ status: string; total_minor: number }[]>`
        select status, total_minor
        from purchase_orders
        where id = ${purchaseOrder.id}
      `;
      assertCondition(draftCheck?.status === "draft", "Purchase order did not start as RFQ/draft.");
      assertCondition(Number(draftCheck.total_minor) === totalMinor, "Purchase order total is incorrect.");

      await sql`
        update purchase_orders
        set status = 'confirmed', confirmed_at = now(), confirmed_by = ${adminUser.id}, updated_at = now()
        where id = ${purchaseOrder.id}
      `;

      const overReceiptQuantity = quantity + 1;
      const [overReceiptCheck] = await sql<{ valid: boolean }[]>`
        select (${overReceiptQuantity} <= quantity_ordered - quantity_received) as valid
        from purchase_order_lines
        where id = ${purchaseOrderLine.id}
      `;
      assertCondition(overReceiptCheck?.valid === false, "Over-receipt guard failed.");

      const [movement] = await sql<{ id: string }[]>`
        insert into stock_movements (
          company_id,
          movement_no,
          movement_type,
          status,
          from_location_id,
          to_location_id,
          source_type,
          source_no,
          posted_at,
          posted_by,
          notes
        )
        values (
          ${company.id},
          ${testNo("PR-E2E")},
          'purchase_receipt',
          'posted',
          ${supplierLocationId},
          ${location.id},
          'goods_receipt',
          'E2E receipt',
          now(),
          ${adminUser.id},
          'E2E purchase receipt stock move'
        )
        returning id
      `;
      assertCondition(movement, "Could not create purchase receipt stock movement.");

      const [receipt] = await sql<{ id: string }[]>`
        insert into goods_receipts (
          company_id,
          purchase_order_id,
          supplier_id,
          location_id,
          receipt_no,
          status,
          posted_at,
          posted_by,
          stock_movement_id,
          supplier_invoice_no
        )
        values (
          ${company.id},
          ${purchaseOrder.id},
          ${supplier.id},
          ${location.id},
          ${testNo("GR-E2E")},
          'posted',
          now(),
          ${adminUser.id},
          ${movement.id},
          ${`SI-${suffix}`}
        )
        returning id
      `;
      assertCondition(receipt, "Could not create goods receipt.");

      const [receiptLine] = await sql<{ id: string }[]>`
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
          ${purchaseOrderLine.id},
          1,
          ${product.id},
          ${unit.id},
          ${quantity},
          ${unitCostMinor},
          ${unitCostMinor},
          ${totalMinor},
          ${company.base_currency_code}
        )
        returning id
      `;
      assertCondition(receiptLine, "Could not create receipt line.");

      await sql`
        insert into stock_movement_lines (
          stock_movement_id,
          line_no,
          product_id,
          from_location_id,
          to_location_id,
          unit_id,
          quantity,
          unit_cost_minor,
          total_cost_minor,
          currency_code,
          notes
        )
        values (
          ${movement.id},
          1,
          ${product.id},
          ${supplierLocationId},
          ${location.id},
          ${unit.id},
          ${quantity},
          ${unitCostMinor},
          ${totalMinor},
          ${company.base_currency_code},
          'E2E received stock'
        )
      `;

      const [balance] = await sql<{ id: string }[]>`
        insert into stock_balances (
          company_id,
          location_id,
          product_id,
          quantity_on_hand,
          quantity_reserved,
          quantity_available,
          average_cost_minor,
          currency_code,
          last_movement_at
        )
        values (
          ${company.id},
          ${location.id},
          ${product.id},
          ${quantity},
          0,
          ${quantity},
          ${unitCostMinor},
          ${company.base_currency_code},
          now()
        )
        returning id
      `;
      assertCondition(balance, "Could not create stock balance.");

      await sql`
        update purchase_order_lines
        set quantity_received = ${quantity}, updated_at = now()
        where id = ${purchaseOrderLine.id}
      `;
      await sql`
        update purchase_orders
        set status = 'received', updated_at = now()
        where id = ${purchaseOrder.id}
      `;

      const [receiptCheck] = await sql<{
        order_status: string;
        receipt_status: string;
        quantity_received: string;
        quantity_on_hand: string;
        movement_from: string;
        movement_to: string;
      }[]>`
        select
          po.status as order_status,
          gr.status as receipt_status,
          pol.quantity_received,
          sb.quantity_on_hand,
          from_location.code as movement_from,
          to_location.code as movement_to
        from goods_receipts gr
        join purchase_orders po on po.id = gr.purchase_order_id
        join purchase_order_lines pol on pol.purchase_order_id = po.id
        join stock_movements sm on sm.id = gr.stock_movement_id
        join locations from_location on from_location.id = sm.from_location_id
        join locations to_location on to_location.id = sm.to_location_id
        join stock_balances sb on sb.id = ${balance.id}
        where gr.id = ${receipt.id}
      `;
      assertCondition(receiptCheck?.order_status === "received", "Purchase order did not move to received.");
      assertCondition(receiptCheck.receipt_status === "posted", "Goods receipt did not post.");
      assertCondition(Number(receiptCheck.quantity_received) === quantity, "PO received quantity is incorrect.");
      assertCondition(Number(receiptCheck.quantity_on_hand) === quantity, "Stock on hand did not increase.");
      assertCondition(receiptCheck.movement_from === "VENDORS", "Receipt movement source is not VENDORS.");
      assertCondition(receiptCheck.movement_to === location.code, "Receipt movement destination is incorrect.");

      const [vendorBill] = await sql<{ id: string }[]>`
        insert into vendor_bills (
          company_id,
          supplier_id,
          purchase_order_id,
          goods_receipt_id,
          bill_no,
          vendor_reference,
          status,
          payment_status,
          bill_date,
          accounting_date,
          posted_at,
          posted_by,
          untaxed_amount_minor,
          tax_amount_minor,
          total_minor,
          currency_code
        )
        values (
          ${company.id},
          ${supplier.id},
          ${purchaseOrder.id},
          ${receipt.id},
          ${testNo("BILL-E2E")},
          ${`BILL-REF-${suffix}`},
          'posted',
          'not_paid',
          ${today},
          ${today},
          now(),
          ${adminUser.id},
          ${subtotalMinor},
          ${taxAmountMinor},
          ${totalMinor},
          ${company.base_currency_code}
        )
        returning id
      `;
      assertCondition(vendorBill, "Could not create vendor bill.");

      await sql`
        insert into vendor_bill_lines (
          vendor_bill_id,
          purchase_order_line_id,
          goods_receipt_line_id,
          line_no,
          product_id,
          description,
          unit_id,
          quantity,
          unit_price_minor,
          subtotal_minor,
          tax_amount_minor,
          total_minor,
          currency_code
        )
        values (
          ${vendorBill.id},
          ${purchaseOrderLine.id},
          ${receiptLine.id},
          1,
          ${product.id},
          'E2E vendor bill line',
          ${unit.id},
          ${quantity},
          ${unitCostMinor},
          ${subtotalMinor},
          ${taxAmountMinor},
          ${totalMinor},
          ${company.base_currency_code}
        )
      `;

      const [paymentMethod] = await sql<{ id: string }[]>`
        insert into payment_methods (
          company_id,
          code,
          name,
          method_type,
          allow_inbound,
          allow_outbound,
          requires_reference,
          is_active
        )
        values (
          ${company.id},
          ${`E2E-BANK-${suffix}`},
          'E2E Bank Transfer',
          'bank_transfer',
          false,
          true,
          false,
          true
        )
        returning id
      `;
      assertCondition(paymentMethod, "Could not create outbound payment method.");

      const [paymentAccount] = await sql<{ id: string }[]>`
        insert into payment_accounts (
          company_id,
          payment_method_id,
          code,
          name,
          institution_name,
          opening_balance_minor,
          currency_code,
          is_active
        )
        values (
          ${company.id},
          ${paymentMethod.id},
          ${`E2E-BANK-ACC-${suffix}`},
          'E2E Bank Account',
          'E2E Bank',
          0,
          ${company.base_currency_code},
          true
        )
        returning id
      `;
      assertCondition(paymentAccount, "Could not create payment account.");

      const [payment] = await sql<{ id: string }[]>`
        insert into payments (
          company_id,
          partner_id,
          payment_no,
          payment_type,
          status,
          payment_date,
          payment_method_id,
          payment_account_id,
          amount_minor,
          currency_code,
          reference,
          posted_at,
          posted_by
        )
        values (
          ${company.id},
          ${supplier.id},
          ${testNo("SPAY-E2E")},
          'outbound',
          'posted',
          now(),
          ${paymentMethod.id},
          ${paymentAccount.id},
          ${totalMinor},
          ${company.base_currency_code},
          'E2E supplier payment',
          now(),
          ${adminUser.id}
        )
        returning id
      `;
      assertCondition(payment, "Could not create supplier payment.");

      await sql`
        insert into payment_allocations (
          payment_id,
          vendor_bill_id,
          amount_minor,
          notes
        )
        values (
          ${payment.id},
          ${vendorBill.id},
          ${totalMinor},
          'E2E full supplier allocation'
        )
      `;
      await sql`
        update vendor_bills
        set payment_status = 'paid', updated_at = now()
        where id = ${vendorBill.id}
      `;

      const [finalCheck] = await sql<{
        bill_status: string;
        payment_status: string;
        residual_minor: number;
        paid_minor: number;
        payment_type: string;
        allow_outbound: boolean;
      }[]>`
        select
          vb.status as bill_status,
          vb.payment_status,
          greatest(vb.total_minor - coalesce(sum(pa.amount_minor) filter (
            where p.status = 'posted' and p.deleted_at is null and pa.deleted_at is null
          ), 0), 0)::bigint as residual_minor,
          coalesce(sum(pa.amount_minor) filter (
            where p.status = 'posted' and p.deleted_at is null and pa.deleted_at is null
          ), 0)::bigint as paid_minor,
          max(p.payment_type::text) as payment_type,
          bool_and(pm.allow_outbound) as allow_outbound
        from vendor_bills vb
        left join payment_allocations pa on pa.vendor_bill_id = vb.id
        left join payments p on p.id = pa.payment_id
        left join payment_methods pm on pm.id = p.payment_method_id
        where vb.id = ${vendorBill.id}
        group by vb.id
      `;
      assertCondition(finalCheck?.bill_status === "posted", "Vendor bill is not posted.");
      assertCondition(finalCheck.payment_status === "paid", "Vendor bill payment status is not paid.");
      assertCondition(Number(finalCheck.residual_minor) === 0, "Vendor bill residual is not zero after full payment.");
      assertCondition(Number(finalCheck.paid_minor) === totalMinor, "Supplier payment allocation total is incorrect.");
      assertCondition(finalCheck.payment_type === "outbound", "Supplier payment is not outbound.");
      assertCondition(finalCheck.allow_outbound === true, "Supplier payment method does not allow outbound payments.");

      const [allocationGuard] = await sql<{ valid: boolean }[]>`
        select (
          (case when vendor_bill_id is not null then 1 else 0 end)
          + (case when expense_id is not null then 1 else 0 end)
          + (case when customer_invoice_id is not null then 1 else 0 end)
        ) = 1 as valid
        from payment_allocations
        where payment_id = ${payment.id}
      `;
      assertCondition(allocationGuard?.valid === true, "Payment allocation target guard failed.");
    } finally {
      await sql`rollback`;
    }

    console.log("E2E purchase flow test passed.");
    console.log(`Company: ${company.code}`);
    console.log(`Receiving location: ${location.code}`);
    console.log("Flow: RFQ -> confirmed PO -> posted receipt -> posted vendor bill -> outbound supplier payment");
    console.log(`Expected totals: subtotal ${subtotalMinor}, tax ${taxAmountMinor}, total ${totalMinor}`);
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
