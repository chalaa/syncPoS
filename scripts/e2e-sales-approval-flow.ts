import "dotenv/config";

import { and, eq, inArray, isNull } from "drizzle-orm";

import { db } from "@/server/db/client";
import {
  auditLogs,
  companies,
  locationApprovers,
  locations,
  partners,
  products,
  salesLineApprovals,
  salesOrderLines,
  salesOrders,
  unitsOfMeasure,
  users,
} from "@/server/db/schema";
import {
  decideSalesLineApproval,
  getBlockingSalesLineApprovals,
  replaceSalesLineApprovals,
} from "@/server/sales/line-approvals";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main() {
  const suffix = Date.now().toString(36).toUpperCase();
  const approvalIds: string[] = [];
  const orderIds: string[] = [];
  const locationIds: string[] = [];

  try {
    const [company] = await db.select().from(companies).where(isNull(companies.deletedAt)).limit(1);
    assert(company, "No active company is available.");

    const testUsers = await db
      .select({ id: users.id, username: users.username })
      .from(users)
      .where(and(eq(users.companyId, company.id), isNull(users.deletedAt)))
      .limit(2);
    assert(testUsers.length === 2, "Two active users are required for the approval test.");
    const [requester, approver] = testUsers;

    const [customer] = await db
      .select({ id: partners.id })
      .from(partners)
      .where(and(eq(partners.companyId, company.id), eq(partners.isCustomer, true), isNull(partners.deletedAt)))
      .limit(1);
    const [product] = await db
      .select({ id: products.id, unitId: products.unitId })
      .from(products)
      .where(and(eq(products.companyId, company.id), eq(products.isActive, true), isNull(products.deletedAt)))
      .limit(1);
    const [fallbackUnit] = await db
      .select({ id: unitsOfMeasure.id })
      .from(unitsOfMeasure)
      .where(and(eq(unitsOfMeasure.companyId, company.id), isNull(unitsOfMeasure.deletedAt)))
      .limit(1);
    assert(customer, "An active customer is required for the approval test.");
    assert(product, "An active product is required for the approval test.");
    const unitId = product.unitId ?? fallbackUnit?.id;
    assert(unitId, "A product unit is required for the approval test.");

    const createdLocations = await db
      .insert(locations)
      .values([
        {
          companyId: company.id,
          code: `AP-${suffix}`.slice(0, 20),
          name: `Approval Test ${suffix}`,
          locationType: "warehouse",
        },
        {
          companyId: company.id,
          code: `NA-${suffix}`.slice(0, 20),
          name: `No Approval Test ${suffix}`,
          locationType: "warehouse",
        },
      ])
      .returning({ id: locations.id });
    assert(createdLocations.length === 2, "Could not create test locations.");
    locationIds.push(...createdLocations.map((location) => location.id));
    const [approvalLocation, openLocation] = createdLocations;

    await db.insert(locationApprovers).values({
      companyId: company.id,
      locationId: approvalLocation.id,
      userId: approver.id,
      canApproveOutgoing: true,
      isActive: true,
    });

    const [order] = await db
      .insert(salesOrders)
      .values({
        companyId: company.id,
        customerId: customer.id,
        sourceLocationId: approvalLocation.id,
        orderNo: `SO-APPROVAL-${suffix}`,
        customerReference: `APPROVAL-${suffix}`,
        paymentTerm: "cash",
        status: "quotation",
        currencyCode: company.baseCurrencyCode,
        reserveOnConfirm: false,
        createdBy: requester.id,
      })
      .returning({ id: salesOrders.id });
    orderIds.push(order.id);

    const lines = await db
      .insert(salesOrderLines)
      .values([
        {
          salesOrderId: order.id,
          sourceLocationId: approvalLocation.id,
          lineNo: 1,
          productId: product.id,
          unitId,
          quantityOrdered: "1",
          currencyCode: company.baseCurrencyCode,
        },
        {
          salesOrderId: order.id,
          sourceLocationId: approvalLocation.id,
          lineNo: 2,
          productId: product.id,
          unitId,
          quantityOrdered: "1",
          currencyCode: company.baseCurrencyCode,
        },
        {
          salesOrderId: order.id,
          sourceLocationId: openLocation.id,
          lineNo: 3,
          productId: product.id,
          unitId,
          quantityOrdered: "1",
          currencyCode: company.baseCurrencyCode,
        },
      ])
      .returning({
        id: salesOrderLines.id,
        lineNo: salesOrderLines.lineNo,
        productId: salesOrderLines.productId,
        sourceLocationId: salesOrderLines.sourceLocationId,
      });

    const firstRequest = await db.transaction((tx) =>
      replaceSalesLineApprovals(tx, {
        companyId: company.id,
        salesOrderId: order.id,
        requestedBy: requester.id,
        lines,
      }),
    );
    assert(firstRequest.required === 2, "Only the two controlled-location lines should require approval.");
    assert(firstRequest.pending === 2, "Both controlled-location lines should initially be pending.");

    let approvals = await db
      .select({ id: salesLineApprovals.id, status: salesLineApprovals.status })
      .from(salesLineApprovals)
      .where(eq(salesLineApprovals.salesOrderId, order.id));
    approvalIds.push(...approvals.map((approval) => approval.id));
    assert(approvals.length === 2, "Expected two approval records.");

    let blockers = await db.transaction((tx) =>
      getBlockingSalesLineApprovals(tx, company.id, order.id),
    );
    assert(blockers.length === 2, "Confirmation should be blocked by both pending lines.");

    let unauthorizedRejected = false;
    try {
      await decideSalesLineApproval({
        companyId: company.id,
        userId: requester.id,
        approvalId: approvals[0].id,
        decision: "approved",
      });
    } catch {
      unauthorizedRejected = true;
    }
    assert(unauthorizedRejected, "A user not assigned to the location must not approve a line.");

    await decideSalesLineApproval({
      companyId: company.id,
      userId: approver.id,
      approvalId: approvals[0].id,
      decision: "approved",
    });
    blockers = await db.transaction((tx) => getBlockingSalesLineApprovals(tx, company.id, order.id));
    assert(blockers.length === 1, "One approved line must leave the other line blocking confirmation.");

    await decideSalesLineApproval({
      companyId: company.id,
      userId: approver.id,
      approvalId: approvals[1].id,
      decision: "approved",
    });
    blockers = await db.transaction((tx) => getBlockingSalesLineApprovals(tx, company.id, order.id));
    assert(blockers.length === 0, "All required approvals should allow confirmation.");

    const secondRequest = await db.transaction((tx) =>
      replaceSalesLineApprovals(tx, {
        companyId: company.id,
        salesOrderId: order.id,
        requestedBy: requester.id,
        lines,
      }),
    );
    assert(secondRequest.pending === 2, "Editing must request both controlled lines again.");

    approvals = await db
      .select({ id: salesLineApprovals.id, status: salesLineApprovals.status })
      .from(salesLineApprovals)
      .where(eq(salesLineApprovals.salesOrderId, order.id));
    approvalIds.push(...approvals.map((approval) => approval.id));
    assert(
      approvals.filter((approval) => approval.status === "cancelled").length === 2 &&
        approvals.filter((approval) => approval.status === "pending").length === 2,
      "Editing must cancel old approvals and create fresh pending approvals.",
    );
    blockers = await db.transaction((tx) => getBlockingSalesLineApprovals(tx, company.id, order.id));
    assert(blockers.length === 2, "The edited quotation must be blocked until re-approved.");

    console.log("PASS: uncontrolled lines do not require approval");
    console.log("PASS: pending approvals block confirmation");
    console.log("PASS: unauthorized users cannot approve");
    console.log("PASS: every required line must be approved");
    console.log("PASS: editing invalidates approvals and requests them again");
  } finally {
    if (approvalIds.length > 0) {
      await db.delete(auditLogs).where(
        and(eq(auditLogs.entityType, "sales_line_approval"), inArray(auditLogs.entityId, approvalIds)),
      );
    }
    if (orderIds.length > 0) {
      await db.delete(salesOrders).where(inArray(salesOrders.id, orderIds));
    }
    if (locationIds.length > 0) {
      await db.delete(locationApprovers).where(inArray(locationApprovers.locationId, locationIds));
      await db.delete(locations).where(inArray(locations.id, locationIds));
    }
  }
}

void main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
