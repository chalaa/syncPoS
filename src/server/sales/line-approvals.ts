import "server-only";

import { and, eq, inArray, isNull, sql } from "drizzle-orm";

import { db } from "@/server/db/client";
import {
  auditLogs,
  locationApprovers,
  locations,
  products,
  salesLineApprovals,
  users,
} from "@/server/db/schema";

type SalesTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

type ApprovalLine = {
  id: string;
  lineNo: number;
  productId: string;
  sourceLocationId: string | null;
};

export async function replaceSalesLineApprovals(
  tx: SalesTransaction,
  params: {
    companyId: string;
    salesOrderId: string;
    requestedBy: string;
    lines: ApprovalLine[];
  },
) {
  await tx
    .update(salesLineApprovals)
    .set({ status: "cancelled", decidedAt: new Date(), updatedAt: sql`now()` })
    .where(
      and(
        eq(salesLineApprovals.companyId, params.companyId),
        eq(salesLineApprovals.salesOrderId, params.salesOrderId),
        inArray(salesLineApprovals.status, ["pending", "approved", "rejected"]),
      ),
    );

  const locationIds = Array.from(
    new Set(params.lines.map((line) => line.sourceLocationId).filter((id): id is string => Boolean(id))),
  );

  if (locationIds.length === 0) {
    return { required: 0, pending: 0 };
  }

  const approverRows = await tx
    .select({ locationId: locationApprovers.locationId, userId: locationApprovers.userId })
    .from(locationApprovers)
    .where(
      and(
        eq(locationApprovers.companyId, params.companyId),
        inArray(locationApprovers.locationId, locationIds),
        eq(locationApprovers.canApproveOutgoing, true),
        eq(locationApprovers.isActive, true),
        isNull(locationApprovers.deletedAt),
      ),
    );

  const approversByLocation = new Map<string, Set<string>>();
  for (const row of approverRows) {
    const approvers = approversByLocation.get(row.locationId) ?? new Set<string>();
    approvers.add(row.userId);
    approversByLocation.set(row.locationId, approvers);
  }

  const requiredLines = params.lines.filter(
    (line): line is ApprovalLine & { sourceLocationId: string } =>
      Boolean(line.sourceLocationId && approversByLocation.has(line.sourceLocationId)),
  );

  if (requiredLines.length === 0) {
    return { required: 0, pending: 0 };
  }

  const now = new Date();
  const values = requiredLines.map((line) => {
    const autoApproved = approversByLocation.get(line.sourceLocationId)?.has(params.requestedBy) ?? false;
    return {
      companyId: params.companyId,
      salesOrderId: params.salesOrderId,
      salesOrderLineId: line.id,
      lineNo: line.lineNo,
      productId: line.productId,
      sourceLocationId: line.sourceLocationId,
      requestedBy: params.requestedBy,
      decidedBy: autoApproved ? params.requestedBy : null,
      status: autoApproved ? ("approved" as const) : ("pending" as const),
      decidedAt: autoApproved ? now : null,
      metadata: { automaticallyApproved: autoApproved },
    };
  });

  const created = await tx.insert(salesLineApprovals).values(values).returning({
    id: salesLineApprovals.id,
    lineNo: salesLineApprovals.lineNo,
    status: salesLineApprovals.status,
    sourceLocationId: salesLineApprovals.sourceLocationId,
  });

  await tx.insert(auditLogs).values(
    created.map((approval) => ({
      companyId: params.companyId,
      actorUserId: params.requestedBy,
      action:
        approval.status === "approved"
          ? "sales_line_approval.auto_approved"
          : "sales_line_approval.requested",
      entityType: "sales_line_approval",
      entityId: approval.id,
      severity: "info" as const,
      metadata: {
        salesOrderId: params.salesOrderId,
        lineNo: approval.lineNo,
        sourceLocationId: approval.sourceLocationId,
      },
    })),
  );

  return {
    required: created.length,
    pending: created.filter((approval) => approval.status === "pending").length,
  };
}

export async function getBlockingSalesLineApprovals(
  tx: SalesTransaction,
  companyId: string,
  salesOrderId: string,
) {
  return tx.execute<{ lineNo: number; productName: string; locationName: string; status: string }>(sql`
    select
      sol.line_no as "lineNo",
      product.name as "productName",
      location.name as "locationName",
      coalesce((
        select sla_status.status::text
        from sales_line_approvals sla_status
        where sla_status.company_id = ${companyId}
          and sla_status.sales_order_id = ${salesOrderId}
          and sla_status.sales_order_line_id = sol.id
        order by sla_status.requested_at desc, sla_status.created_at desc
        limit 1
      ), 'missing') as status
    from sales_order_lines sol
    inner join products product on product.id = sol.product_id
    inner join locations location on location.id = sol.source_location_id
    where sol.sales_order_id = ${salesOrderId}
      and sol.deleted_at is null
      and exists (
        select 1
        from location_approvers la
        where la.company_id = ${companyId}
          and la.location_id = sol.source_location_id
          and la.can_approve_outgoing = true
          and la.is_active = true
          and la.deleted_at is null
      )
      and not exists (
        select 1
        from sales_line_approvals sla
        where sla.company_id = ${companyId}
          and sla.sales_order_id = ${salesOrderId}
          and sla.sales_order_line_id = sol.id
          and sla.status = 'approved'
      )
    order by sol.line_no
  `);
}

export async function getSalesLineApprovalSummary(
  companyId: string,
  salesOrderId: string,
  userId: string,
) {
  return db
    .select({
      id: salesLineApprovals.id,
      salesOrderLineId: salesLineApprovals.salesOrderLineId,
      lineNo: salesLineApprovals.lineNo,
      productName: products.name,
      locationCode: locations.code,
      locationName: locations.name,
      status: salesLineApprovals.status,
      requestedAt: salesLineApprovals.requestedAt,
      decidedAt: salesLineApprovals.decidedAt,
      decidedByName: users.username,
      notes: salesLineApprovals.notes,
      canApprove: sql<boolean>`exists (
        select 1 from location_approvers la
        where la.company_id = ${companyId}
          and la.location_id = ${salesLineApprovals.sourceLocationId}
          and la.user_id = ${userId}
          and la.can_approve_outgoing = true
          and la.is_active = true
          and la.deleted_at is null
      )`,
    })
    .from(salesLineApprovals)
    .innerJoin(products, eq(salesLineApprovals.productId, products.id))
    .innerJoin(locations, eq(salesLineApprovals.sourceLocationId, locations.id))
    .leftJoin(users, eq(salesLineApprovals.decidedBy, users.id))
    .where(
      and(
        eq(salesLineApprovals.companyId, companyId),
        eq(salesLineApprovals.salesOrderId, salesOrderId),
        inArray(salesLineApprovals.status, ["pending", "approved", "rejected"]),
      ),
    )
    .orderBy(salesLineApprovals.lineNo);
}

export async function decideSalesLineApproval(params: {
  companyId: string;
  userId: string;
  approvalId: string;
  decision: "approved" | "rejected";
  notes?: string | null;
}) {
  await db.transaction(async (tx) => {
    const [approval] = await tx
      .select({
        id: salesLineApprovals.id,
        salesOrderId: salesLineApprovals.salesOrderId,
        sourceLocationId: salesLineApprovals.sourceLocationId,
        status: salesLineApprovals.status,
      })
      .from(salesLineApprovals)
      .where(
        and(
          eq(salesLineApprovals.id, params.approvalId),
          eq(salesLineApprovals.companyId, params.companyId),
        ),
      )
      .limit(1);

    if (!approval || approval.status !== "pending") {
      throw new Error("Pending line approval does not exist.");
    }

    const [assignment] = await tx
      .select({ id: locationApprovers.id })
      .from(locationApprovers)
      .where(
        and(
          eq(locationApprovers.companyId, params.companyId),
          eq(locationApprovers.locationId, approval.sourceLocationId),
          eq(locationApprovers.userId, params.userId),
          eq(locationApprovers.canApproveOutgoing, true),
          eq(locationApprovers.isActive, true),
          isNull(locationApprovers.deletedAt),
        ),
      )
      .limit(1);

    if (!assignment) {
      throw new Error("You are not assigned as an approver for this location.");
    }

    const [updated] = await tx
      .update(salesLineApprovals)
      .set({
        status: params.decision,
        decidedBy: params.userId,
        decidedAt: new Date(),
        notes: params.notes ?? null,
        updatedAt: sql`now()`,
      })
      .where(and(eq(salesLineApprovals.id, approval.id), eq(salesLineApprovals.status, "pending")))
      .returning({ id: salesLineApprovals.id });

    if (!updated) {
      throw new Error("This line approval was already decided by another user.");
    }

    await tx.insert(auditLogs).values({
      companyId: params.companyId,
      actorUserId: params.userId,
      action: `sales_line_approval.${params.decision}`,
      entityType: "sales_line_approval",
      entityId: approval.id,
      severity: params.decision === "rejected" ? "warning" : "info",
      metadata: { salesOrderId: approval.salesOrderId, sourceLocationId: approval.sourceLocationId },
    });
  });
}
