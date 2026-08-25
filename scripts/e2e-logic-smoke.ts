import "dotenv/config";

import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL ?? "";

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required.");
}

type LocationType = "supplier" | "customer";

const virtualLocations: Record<LocationType, { code: string; name: string }> = {
  supplier: {
    code: "VENDORS",
    name: "Vendor Location",
  },
  customer: {
    code: "CUSTOMERS",
    name: "Customer Location",
  },
};

function assertCondition(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function ensureVirtualLocation(
  sql: postgres.Sql,
  companyId: string,
  type: LocationType,
) {
  const defaults = virtualLocations[type];
  const [existing] = await sql<{ id: string; code: string; name: string }[]>`
    select id, code, name
    from locations
    where company_id = ${companyId}
      and code = ${defaults.code}
      and deleted_at is null
    limit 1
  `;

  if (existing) {
    await sql`
      update locations
      set
        name = ${defaults.name},
        location_type = ${type},
        is_active = true,
        offline_sales_enabled = false,
        allow_negative_stock = false,
        updated_at = now()
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
    values (
      ${companyId},
      ${defaults.code},
      ${defaults.name},
      ${type},
      false,
      false,
      true
    )
    returning id
  `;

  assertCondition(created, `Could not create ${defaults.code} virtual location.`);

  return created.id;
}

async function main() {
  const sql = postgres(databaseUrl, { max: 1 });

  try {
    const [company] = await sql<{ id: string; code: string }[]>`
      select id, code
      from companies
      where deleted_at is null
      order by created_at asc
      limit 1
    `;

    assertCondition(company, "No company found. Run pnpm db:seed first.");

    const [internalLocation] = await sql<{ id: string; code: string }[]>`
      select id, code
      from locations
      where company_id = ${company.id}
        and location_type in ('warehouse', 'display_shop')
        and is_active = true
        and deleted_at is null
      order by case when location_type = 'display_shop' then 0 else 1 end, code asc
      limit 1
    `;

    assertCondition(internalLocation, "No active warehouse or display shop location found.");

    const supplierLocationId = await ensureVirtualLocation(sql, company.id, "supplier");
    const customerLocationId = await ensureVirtualLocation(sql, company.id, "customer");

    const duplicateRows = await sql<{ code: string; count: number }[]>`
      select code, count(*)::int as count
      from locations
      where company_id = ${company.id}
        and code in ('VENDORS', 'CUSTOMERS')
        and deleted_at is null
      group by code
      having count(*) > 1
    `;

    assertCondition(duplicateRows.length === 0, "Duplicate active virtual partner locations found.");

    const testSuffix = new Date().toISOString().replace(/[-:.TZ]/g, "");
    await sql`begin`;

    try {
      const [receiptMove] = await sql<{ id: string }[]>`
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
          notes
        )
        values (
          ${company.id},
          ${`TEST-PR-${testSuffix}`},
          'purchase_receipt',
          'posted',
          ${supplierLocationId},
          ${internalLocation.id},
          'e2e_logic_smoke',
          ${`TEST-RECEIPT-${testSuffix}`},
          now(),
          'Rolled back e2e receipt direction test'
        )
        returning id
      `;
      const [deliveryMove] = await sql<{ id: string }[]>`
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
          notes
        )
        values (
          ${company.id},
          ${`TEST-SD-${testSuffix}`},
          'sale_delivery',
          'posted',
          ${internalLocation.id},
          ${customerLocationId},
          'e2e_logic_smoke',
          ${`TEST-DELIVERY-${testSuffix}`},
          now(),
          'Rolled back e2e delivery direction test'
        )
        returning id
      `;

      assertCondition(receiptMove && deliveryMove, "Could not insert temporary stock movement tests.");

      const [directionCheck] = await sql<{
        receipt_from: string;
        receipt_to: string;
        delivery_from: string;
        delivery_to: string;
      }[]>`
        select
          receipt_from.code as receipt_from,
          receipt_to.code as receipt_to,
          delivery_from.code as delivery_from,
          delivery_to.code as delivery_to
        from stock_movements receipt
        join locations receipt_from on receipt_from.id = receipt.from_location_id
        join locations receipt_to on receipt_to.id = receipt.to_location_id
        cross join stock_movements delivery
        join locations delivery_from on delivery_from.id = delivery.from_location_id
        join locations delivery_to on delivery_to.id = delivery.to_location_id
        where receipt.id = ${receiptMove.id}
          and delivery.id = ${deliveryMove.id}
      `;

      assertCondition(directionCheck, "Could not verify temporary stock movement directions.");
      assertCondition(directionCheck.receipt_from === "VENDORS", "Receipt source is not VENDORS.");
      assertCondition(directionCheck.receipt_to === internalLocation.code, "Receipt destination is not the internal location.");
      assertCondition(directionCheck.delivery_from === internalLocation.code, "Delivery source is not the internal location.");
      assertCondition(directionCheck.delivery_to === "CUSTOMERS", "Delivery destination is not CUSTOMERS.");
    } finally {
      await sql`rollback`;
    }

    const [movementSummary] = await sql<{
      purchase_receipts: number;
      sale_deliveries: number;
      purchase_receipts_with_partner_source: number;
      sale_deliveries_with_partner_destination: number;
    }[]>`
      select
        count(*) filter (where sm.movement_type = 'purchase_receipt')::int as purchase_receipts,
        count(*) filter (where sm.movement_type = 'sale_delivery')::int as sale_deliveries,
        count(*) filter (
          where sm.movement_type = 'purchase_receipt'
            and source_location.location_type = 'supplier'
        )::int as purchase_receipts_with_partner_source,
        count(*) filter (
          where sm.movement_type = 'sale_delivery'
            and destination_location.location_type = 'customer'
        )::int as sale_deliveries_with_partner_destination
      from stock_movements sm
      left join locations source_location on source_location.id = sm.from_location_id
      left join locations destination_location on destination_location.id = sm.to_location_id
      where sm.company_id = ${company.id}
        and sm.status = 'posted'
        and sm.deleted_at is null
        and sm.movement_type in ('purchase_receipt', 'sale_delivery')
    `;

    console.log("E2E logic smoke test passed.");
    console.log(`Company: ${company.code}`);
    console.log(`Internal test location: ${internalLocation.code}`);
    console.log(`Posted purchase receipts using partner source: ${movementSummary?.purchase_receipts_with_partner_source ?? 0}/${movementSummary?.purchase_receipts ?? 0}`);
    console.log(`Posted sales deliveries using partner destination: ${movementSummary?.sale_deliveries_with_partner_destination ?? 0}/${movementSummary?.sale_deliveries ?? 0}`);
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
