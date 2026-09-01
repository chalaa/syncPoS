import "dotenv/config";

import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL ?? "";

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required.");
}

const quantity = 2;
const unitPriceMinor = 150_00;
const unitCostMinor = 90_00;
const subtotalMinor = quantity * unitPriceMinor;
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

async function ensureCustomerLocation(sql: postgres.Sql, companyId: string) {
  const [existing] = await sql<{ id: string }[]>`
    select id
    from locations
    where company_id = ${companyId}
      and code = 'CUSTOMERS'
      and deleted_at is null
    limit 1
  `;

  if (existing) {
    await sql`
      update locations
      set location_type = 'customer', is_active = true, updated_at = now()
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
    values (${companyId}, 'CUSTOMERS', 'Customer Location', 'customer', false, false, true)
    returning id
  `;

  assertCondition(created, "Could not create customer virtual location.");

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
        and location_type in ('display_shop', 'warehouse')
        and is_active = true
        and deleted_at is null
      order by case when location_type = 'display_shop' then 0 else 1 end, code asc
      limit 1
    `;
    assertCondition(location, "No active sales source location found.");

    const [unit] = await sql<{ id: string }[]>`
      select id
      from units_of_measure
      where company_id = ${company.id}
        and deleted_at is null
      order by created_at asc
      limit 1
    `;
    assertCondition(unit, "No unit of measure found. Create or seed a unit first.");

    const customerLocationId = await ensureCustomerLocation(sql, company.id);
    const suffix = testNo("FLOW");

    await sql`begin`;

    try {
      const [customer] = await sql<{ id: string }[]>`
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
          ${`CUST-${suffix}`},
          ${`E2E Sales Customer ${suffix}`},
          ${`E2E Sales Customer ${suffix}`},
          true,
          false,
          ${totalMinor * 2},
          ${company.base_currency_code},
          'active'
        )
        returning id
      `;
      assertCondition(customer, "Could not create test customer.");

      const [product] = await sql<{ id: string }[]>`
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
          ${`SKU-${suffix}`},
          ${`E2E Sales Product ${suffix}`},
          ${unit.id},
          'none',
          ${unitCostMinor},
          ${unitPriceMinor},
          ${company.base_currency_code},
          true
        )
        returning id
      `;
      assertCondition(product, "Could not create test product.");

      const openingQuantity = 5;
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
          ${openingQuantity},
          0,
          ${openingQuantity},
          ${unitCostMinor},
          ${company.base_currency_code},
          now()
        )
        returning id
      `;
      assertCondition(balance, "Could not create test stock balance.");

      const [salesOrder] = await sql<{ id: string }[]>`
        insert into sales_orders (
          company_id,
          customer_id,
          source_location_id,
          order_no,
          customer_reference,
          status,
          order_date,
          currency_code,
          subtotal_minor,
          tax_amount_minor,
          total_minor,
          reserve_on_confirm,
          created_by
        )
        values (
          ${company.id},
          ${customer.id},
          ${location.id},
          ${testNo("SO-E2E")},
          'E2E customer reference',
          'quotation',
          ${today},
          ${company.base_currency_code},
          ${subtotalMinor},
          ${taxAmountMinor},
          ${totalMinor},
          false,
          ${adminUser.id}
        )
        returning id
      `;
      assertCondition(salesOrder, "Could not create quotation.");

      const [salesOrderLine] = await sql<{ id: string }[]>`
        insert into sales_order_lines (
          sales_order_id,
          line_no,
          product_id,
          description,
          unit_id,
          quantity_ordered,
          quantity_reserved,
          quantity_delivered,
          quantity_invoiced,
          unit_price_minor,
          discount_minor,
          tax_amount_minor,
          line_total_minor,
          currency_code
        )
        values (
          ${salesOrder.id},
          1,
          ${product.id},
          'E2E sales line',
          ${unit.id},
          ${quantity},
          0,
          0,
          0,
          ${unitPriceMinor},
          0,
          ${taxAmountMinor},
          ${totalMinor},
          ${company.base_currency_code}
        )
        returning id
      `;
      assertCondition(salesOrderLine, "Could not create sales order line.");

      const [quotation] = await sql<{ status: string; total_minor: number }[]>`
        select status, total_minor
        from sales_orders
        where id = ${salesOrder.id}
      `;
      assertCondition(quotation?.status === "quotation", "Sales order did not start as quotation.");
      assertCondition(Number(quotation.total_minor) === totalMinor, "Quotation total is incorrect.");

      await sql`
        update sales_orders
        set status = 'confirmed', confirmed_at = now(), confirmed_by = ${adminUser.id}, updated_at = now()
        where id = ${salesOrder.id}
      `;

      const overDeliveryQuantity = openingQuantity + 1;
      const [overDeliveryCheck] = await sql<{ can_deliver: boolean }[]>`
        select cast(quantity_available as numeric) >= ${overDeliveryQuantity} as can_deliver
        from stock_balances
        where id = ${balance.id}
      `;
      assertCondition(overDeliveryCheck?.can_deliver === false, "Over-delivery guard failed.");

      const [delivery] = await sql<{ id: string }[]>`
        insert into deliveries (
          company_id,
          sales_order_id,
          customer_id,
          source_location_id,
          delivery_no,
          status
        )
        values (
          ${company.id},
          ${salesOrder.id},
          ${customer.id},
          ${location.id},
          ${testNo("DEL-E2E")},
          'draft'
        )
        returning id
      `;
      assertCondition(delivery, "Could not create delivery.");

      const totalCostMinor = quantity * unitCostMinor;
      const [deliveryLine] = await sql<{ id: string }[]>`
        insert into delivery_lines (
          delivery_id,
          sales_order_line_id,
          line_no,
          product_id,
          unit_id,
          quantity_delivered,
          unit_cost_minor,
          total_cost_minor,
          currency_code
        )
        values (
          ${delivery.id},
          ${salesOrderLine.id},
          1,
          ${product.id},
          ${unit.id},
          ${quantity},
          ${unitCostMinor},
          ${totalCostMinor},
          ${company.base_currency_code}
        )
        returning id
      `;
      assertCondition(deliveryLine, "Could not create delivery line.");

      const [movement] = await sql<{ id: string }[]>`
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
          posted_at,
          posted_by,
          notes
        )
        values (
          ${company.id},
          ${testNo("SD-E2E")},
          'sale_delivery',
          'posted',
          ${location.id},
          ${customerLocationId},
          'delivery',
          ${delivery.id},
          'E2E delivery',
          now(),
          ${adminUser.id},
          'E2E sales delivery stock move'
        )
        returning id
      `;
      assertCondition(movement, "Could not create delivery stock movement.");

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
          ${location.id},
          ${customerLocationId},
          ${unit.id},
          ${quantity},
          ${unitCostMinor},
          ${totalCostMinor},
          ${company.base_currency_code},
          'E2E delivered stock'
        )
      `;

      await sql`
        update stock_balances
        set
          quantity_on_hand = cast(quantity_on_hand as numeric) - ${quantity},
          quantity_available = cast(quantity_available as numeric) - ${quantity},
          last_movement_at = now(),
          updated_at = now()
        where id = ${balance.id}
      `;
      await sql`
        update sales_order_lines
        set quantity_delivered = ${quantity}, updated_at = now()
        where id = ${salesOrderLine.id}
      `;
      await sql`
        update deliveries
        set status = 'posted', posted_at = now(), posted_by = ${adminUser.id}, stock_movement_id = ${movement.id}, updated_at = now()
        where id = ${delivery.id}
      `;
      await sql`
        update sales_orders
        set status = 'delivered', updated_at = now()
        where id = ${salesOrder.id}
      `;

      const [deliveryCheck] = await sql<{
        delivery_status: string;
        order_status: string;
        quantity_on_hand: string;
        quantity_available: string;
        movement_from: string;
        movement_to: string;
      }[]>`
        select
          d.status as delivery_status,
          so.status as order_status,
          sb.quantity_on_hand,
          sb.quantity_available,
          from_location.code as movement_from,
          to_location.code as movement_to
        from deliveries d
        join sales_orders so on so.id = d.sales_order_id
        join stock_movements sm on sm.id = d.stock_movement_id
        join locations from_location on from_location.id = sm.from_location_id
        join locations to_location on to_location.id = sm.to_location_id
        join stock_balances sb on sb.id = ${balance.id}
        where d.id = ${delivery.id}
      `;
      assertCondition(deliveryCheck?.delivery_status === "posted", "Delivery did not post.");
      assertCondition(deliveryCheck.order_status === "delivered", "Sales order did not move to delivered.");
      assertCondition(Number(deliveryCheck.quantity_on_hand) === openingQuantity - quantity, "Stock on hand did not decrease.");
      assertCondition(Number(deliveryCheck.quantity_available) === openingQuantity - quantity, "Available stock did not decrease.");
      assertCondition(deliveryCheck.movement_from === location.code, "Delivery movement source is incorrect.");
      assertCondition(deliveryCheck.movement_to === "CUSTOMERS", "Delivery movement destination is not CUSTOMERS.");

      const [invoice] = await sql<{ id: string }[]>`
        insert into customer_invoices (
          company_id,
          sales_order_id,
          delivery_id,
          customer_id,
          invoice_no,
          customer_reference,
          status,
          payment_status,
          invoice_date,
          posted_at,
          posted_by,
          currency_code,
          untaxed_amount_minor,
          tax_amount_minor,
          total_minor
        )
        values (
          ${company.id},
          ${salesOrder.id},
          ${delivery.id},
          ${customer.id},
          ${testNo("INV-E2E")},
          'E2E customer reference',
          'posted',
          'not_paid',
          ${today},
          now(),
          ${adminUser.id},
          ${company.base_currency_code},
          ${subtotalMinor},
          ${taxAmountMinor},
          ${totalMinor}
        )
        returning id
      `;
      assertCondition(invoice, "Could not create customer invoice.");

      await sql`
        insert into customer_invoice_lines (
          customer_invoice_id,
          sales_order_line_id,
          delivery_line_id,
          line_no,
          product_id,
          description,
          quantity,
          unit_price_minor,
          discount_minor,
          tax_amount_minor,
          line_total_minor,
          currency_code
        )
        values (
          ${invoice.id},
          ${salesOrderLine.id},
          ${deliveryLine.id},
          1,
          ${product.id},
          'E2E invoice line',
          ${quantity},
          ${unitPriceMinor},
          0,
          ${taxAmountMinor},
          ${totalMinor},
          ${company.base_currency_code}
        )
      `;
      await sql`
        update sales_order_lines
        set quantity_invoiced = ${quantity}, updated_at = now()
        where id = ${salesOrderLine.id}
      `;
      await sql`
        update sales_orders
        set status = 'invoiced', updated_at = now()
        where id = ${salesOrder.id}
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
          ${`E2E-CASH-${suffix}`},
          'E2E Cash',
          'cash',
          true,
          false,
          false,
          true
        )
        returning id
      `;
      assertCondition(paymentMethod, "Could not create payment method.");

      const [paymentAccount] = await sql<{ id: string }[]>`
        insert into payment_accounts (
          company_id,
          payment_method_id,
          code,
          name,
          opening_balance_minor,
          currency_code,
          is_active
        )
        values (
          ${company.id},
          ${paymentMethod.id},
          ${`E2E-CASH-ACC-${suffix}`},
          'E2E Cash Account',
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
          ${customer.id},
          ${testNo("PAY-E2E")},
          'inbound',
          'posted',
          now(),
          ${paymentMethod.id},
          ${paymentAccount.id},
          ${totalMinor},
          ${company.base_currency_code},
          'E2E full payment',
          now(),
          ${adminUser.id}
        )
        returning id
      `;
      assertCondition(payment, "Could not create customer payment.");

      await sql`
        insert into payment_allocations (
          payment_id,
          customer_invoice_id,
          amount_minor,
          notes
        )
        values (
          ${payment.id},
          ${invoice.id},
          ${totalMinor},
          'E2E full allocation'
        )
      `;
      await sql`
        update customer_invoices
        set payment_status = 'paid', updated_at = now()
        where id = ${invoice.id}
      `;

      const [finalCheck] = await sql<{
        order_status: string;
        invoice_status: string;
        payment_status: string;
        residual_minor: number;
        paid_minor: number;
        payment_type: string;
      }[]>`
        select
          so.status as order_status,
          ci.status as invoice_status,
          ci.payment_status,
          greatest(ci.total_minor - coalesce(sum(pa.amount_minor) filter (
            where p.status = 'posted' and p.deleted_at is null and pa.deleted_at is null
          ), 0), 0)::bigint as residual_minor,
          coalesce(sum(pa.amount_minor) filter (
            where p.status = 'posted' and p.deleted_at is null and pa.deleted_at is null
          ), 0)::bigint as paid_minor,
          max(p.payment_type::text) as payment_type
        from customer_invoices ci
        join sales_orders so on so.id = ci.sales_order_id
        left join payment_allocations pa on pa.customer_invoice_id = ci.id
        left join payments p on p.id = pa.payment_id
        where ci.id = ${invoice.id}
        group by so.id, ci.id
      `;
      assertCondition(finalCheck?.order_status === "invoiced", "Sales order did not move to invoiced.");
      assertCondition(finalCheck.invoice_status === "posted", "Invoice is not posted.");
      assertCondition(finalCheck.payment_status === "paid", "Invoice payment status is not paid.");
      assertCondition(Number(finalCheck.residual_minor) === 0, "Invoice residual is not zero after full payment.");
      assertCondition(Number(finalCheck.paid_minor) === totalMinor, "Payment allocation total is incorrect.");
      assertCondition(finalCheck.payment_type === "inbound", "Customer payment is not inbound.");

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

    console.log("E2E sales flow test passed.");
    console.log(`Company: ${company.code}`);
    console.log(`Source location: ${location.code}`);
    console.log(`Flow: quotation -> confirmed order -> posted delivery -> posted invoice -> inbound payment`);
    console.log(`Expected totals: subtotal ${subtotalMinor}, tax ${taxAmountMinor}, total ${totalMinor}`);
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
