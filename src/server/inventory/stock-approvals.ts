import "server-only";

import { and, asc, eq, inArray, isNull, or, sql } from "drizzle-orm";

import { db } from "@/server/db/client";
import {
  auditLogs,
  locationApprovers,
  locations,
  stockOutApprovals,
  users,
} from "@/server/db/schema";

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

type ApprovalSource = {
  companyId: string;
  requestedBy: string;
  sourceType: string;
  sourceId?: string | null;
  stockMovementId?: string | null;
  sourceNo?: string | null;
  sourceLocationIds: string[];
  reason?: string | null;
  metadata?: Record<string, unknown>;
};

export async function requireStockOutApproval(tx: DbTransaction, params: ApprovalSource) {
  const sourceLocationIds = Array.from(new Set(params.sourceLocationIds.filter(Boolean)));

  if (sourceLocationIds.length === 0) {
    return;
  }

  const protectedLocations = await tx
    .select({
      locationId: locationApprovers.locationId,
      locationCode: locations.code,
      locationName: locations.name,
    })
    .from(locationApprovers)
    .innerJoin(locations, eq(locationApprovers.locationId, locations.id))
    .where(
      and(
        eq(locationApprovers.companyId, params.companyId),
        inArray(locationApprovers.locationId, sourceLocationIds),
        eq(locationApprovers.canApproveOutgoing, true),
        eq(locationApprovers.isActive, true),
        isNull(locationApprovers.deletedAt),
        isNull(locations.deletedAt),
      ),
    );

  const uniqueLocations = Array.from(
    new Map(protectedLocations.map((location) => [location.locationId, location])).values(),
  );

  if (uniqueLocations.length === 0) {
    return;
  }

  const requesterApproverRows = await tx
    .select({ locationId: locationApprovers.locationId })
    .from(locationApprovers)
    .where(
      and(
        eq(locationApprovers.companyId, params.companyId),
        eq(locationApprovers.userId, params.requestedBy),
        inArray(locationApprovers.locationId, uniqueLocations.map((location) => location.locationId)),
        eq(locationApprovers.canApproveOutgoing, true),
        eq(locationApprovers.isActive, true),
        isNull(locationApprovers.deletedAt),
      ),
    );
  const requesterApproverLocationIds = new Set(requesterApproverRows.map((row) => row.locationId));
  const locationsNeedingApproval = uniqueLocations.filter((location) => !requesterApproverLocationIds.has(location.locationId));

  if (locationsNeedingApproval.length === 0) {
    return;
  }

  if (!params.sourceId && !params.stockMovementId && !params.sourceNo) {
    throw new Error("Source reference is required when stock leaves an approval-controlled location.");
  }

  const missingApprovals: string[] = [];

  for (const location of locationsNeedingApproval) {
    const sourceFilter = params.sourceId
      ? eq(stockOutApprovals.sourceId, params.sourceId)
      : params.stockMovementId
        ? eq(stockOutApprovals.stockMovementId, params.stockMovementId)
        : eq(stockOutApprovals.sourceNo, params.sourceNo ?? "");

    const [approval] = await tx
      .select({
        id: stockOutApprovals.id,
        status: stockOutApprovals.status,
      })
      .from(stockOutApprovals)
      .where(
        and(
          eq(stockOutApprovals.companyId, params.companyId),
          eq(stockOutApprovals.sourceType, params.sourceType),
          sourceFilter,
          eq(stockOutApprovals.sourceLocationId, location.locationId),
          or(eq(stockOutApprovals.status, "pending"), eq(stockOutApprovals.status, "approved")),
        ),
      )
      .orderBy(sql`${stockOutApprovals.createdAt} desc`)
      .limit(1);

    if (approval?.status === "approved") {
      continue;
    }

    if (!approval) {
      await db.transaction(async (approvalTx) => {
        const [created] = await approvalTx
          .insert(stockOutApprovals)
          .values({
            companyId: params.companyId,
            sourceType: params.sourceType,
            sourceId: params.sourceId ?? null,
            stockMovementId: params.stockMovementId ?? null,
            sourceNo: params.sourceNo ?? null,
            sourceLocationId: location.locationId,
            requestedBy: params.requestedBy,
            status: "pending",
            reason: params.reason ?? "Stock is leaving a protected location.",
            metadata: params.metadata ?? {},
          })
          .returning({ id: stockOutApprovals.id });

        await approvalTx.insert(auditLogs).values({
          companyId: params.companyId,
          actorUserId: params.requestedBy,
          action: "stock_out_approval.requested",
          entityType: "stock_out_approval",
          entityId: created.id,
          severity: "warning",
          metadata: {
            sourceType: params.sourceType,
            sourceId: params.sourceId ?? null,
            sourceNo: params.sourceNo ?? null,
            stockMovementId: params.stockMovementId ?? null,
            sourceLocationId: location.locationId,
          },
        });
      });
    }

    missingApprovals.push(`${location.locationCode} / ${location.locationName}`);
  }

  if (missingApprovals.length > 0) {
    throw new Error(`Stock-out approval is required for ${missingApprovals.join(", ")}.`);
  }
}

export async function getStockOutApprovalRows(companyId: string, status = "pending") {
  const statusFilter =
    status === "approved" || status === "rejected" || status === "cancelled"
      ? eq(stockOutApprovals.status, status)
      : eq(stockOutApprovals.status, "pending");

  return db
    .select({
      id: stockOutApprovals.id,
      sourceType: stockOutApprovals.sourceType,
      sourceId: stockOutApprovals.sourceId,
      stockMovementId: stockOutApprovals.stockMovementId,
      sourceNo: stockOutApprovals.sourceNo,
      sourceLocationId: stockOutApprovals.sourceLocationId,
      sourceLocationCode: locations.code,
      sourceLocationName: locations.name,
      requestedByUsername: users.username,
      approverUserId: stockOutApprovals.approverUserId,
      status: stockOutApprovals.status,
      reason: stockOutApprovals.reason,
      notes: stockOutApprovals.notes,
      requestedAt: stockOutApprovals.requestedAt,
      approvedAt: stockOutApprovals.approvedAt,
      rejectedAt: stockOutApprovals.rejectedAt,
    })
    .from(stockOutApprovals)
    .innerJoin(locations, eq(stockOutApprovals.sourceLocationId, locations.id))
    .leftJoin(users, eq(stockOutApprovals.requestedBy, users.id))
    .where(and(eq(stockOutApprovals.companyId, companyId), statusFilter))
    .orderBy(asc(stockOutApprovals.requestedAt));
}

export async function userCanApproveLocation(tx: DbTransaction, params: {
  companyId: string;
  userId: string;
  locationId: string;
}) {
  const [row] = await tx
    .select({ id: locationApprovers.id })
    .from(locationApprovers)
    .where(
      and(
        eq(locationApprovers.companyId, params.companyId),
        eq(locationApprovers.userId, params.userId),
        eq(locationApprovers.locationId, params.locationId),
        eq(locationApprovers.canApproveOutgoing, true),
        eq(locationApprovers.isActive, true),
        isNull(locationApprovers.deletedAt),
      ),
    )
    .limit(1);

  return Boolean(row);
}

export type StockOutApprovalState = {
  isProtected: boolean;
  pendingApprovalIds: string[];
  approvedApprovalIds: string[];
  canApprove: boolean;
  locationNames: string[];
};

export async function getStockOutApprovalState(params: {
  companyId: string;
  userId: string;
  sourceType: string;
  sourceId?: string | null;
  stockMovementId?: string | null;
  sourceNo?: string | null;
  sourceLocationIds: string[];
}): Promise<StockOutApprovalState> {
  const sourceLocationIds = Array.from(new Set(params.sourceLocationIds.filter(Boolean)));

  if (sourceLocationIds.length === 0) {
    return {
      isProtected: false,
      pendingApprovalIds: [],
      approvedApprovalIds: [],
      canApprove: false,
      locationNames: [],
    };
  }

  const protectedLocations = await db
    .select({
      locationId: locationApprovers.locationId,
      locationCode: locations.code,
      locationName: locations.name,
    })
    .from(locationApprovers)
    .innerJoin(locations, eq(locationApprovers.locationId, locations.id))
    .where(
      and(
        eq(locationApprovers.companyId, params.companyId),
        inArray(locationApprovers.locationId, sourceLocationIds),
        eq(locationApprovers.canApproveOutgoing, true),
        eq(locationApprovers.isActive, true),
        isNull(locationApprovers.deletedAt),
        isNull(locations.deletedAt),
      ),
    );
  const uniqueLocations = Array.from(
    new Map(protectedLocations.map((location) => [location.locationId, location])).values(),
  );

  if (uniqueLocations.length === 0) {
    return {
      isProtected: false,
      pendingApprovalIds: [],
      approvedApprovalIds: [],
      canApprove: false,
      locationNames: [],
    };
  }

  const sourceFilter = params.sourceId
    ? eq(stockOutApprovals.sourceId, params.sourceId)
    : params.stockMovementId
      ? eq(stockOutApprovals.stockMovementId, params.stockMovementId)
      : eq(stockOutApprovals.sourceNo, params.sourceNo ?? "");
  const approvals = await db
    .select({
      id: stockOutApprovals.id,
      status: stockOutApprovals.status,
      sourceLocationId: stockOutApprovals.sourceLocationId,
    })
    .from(stockOutApprovals)
    .where(
      and(
        eq(stockOutApprovals.companyId, params.companyId),
        eq(stockOutApprovals.sourceType, params.sourceType),
        sourceFilter,
        inArray(stockOutApprovals.sourceLocationId, uniqueLocations.map((location) => location.locationId)),
        or(eq(stockOutApprovals.status, "pending"), eq(stockOutApprovals.status, "approved")),
      ),
    );
  const approvableRows = await db
    .select({ locationId: locationApprovers.locationId })
    .from(locationApprovers)
    .where(
      and(
        eq(locationApprovers.companyId, params.companyId),
        eq(locationApprovers.userId, params.userId),
        inArray(locationApprovers.locationId, uniqueLocations.map((location) => location.locationId)),
        eq(locationApprovers.canApproveOutgoing, true),
        eq(locationApprovers.isActive, true),
        isNull(locationApprovers.deletedAt),
      ),
    );
  const requesterCanApproveAll = approvableRows.length === uniqueLocations.length;

  if (requesterCanApproveAll) {
    return {
      isProtected: false,
      pendingApprovalIds: [],
      approvedApprovalIds: [],
      canApprove: true,
      locationNames: uniqueLocations.map((location) => `${location.locationCode} / ${location.locationName}`),
    };
  }

  return {
    isProtected: true,
    pendingApprovalIds: approvals.filter((approval) => approval.status === "pending").map((approval) => approval.id),
    approvedApprovalIds: approvals.filter((approval) => approval.status === "approved").map((approval) => approval.id),
    canApprove: false,
    locationNames: uniqueLocations.map((location) => `${location.locationCode} / ${location.locationName}`),
  };
}

export async function approveStockOutApprovals(params: {
  companyId: string;
  userId: string;
  approvalIds: string[];
  notes?: string | null;
}) {
  const approvalIds = Array.from(new Set(params.approvalIds));

  if (approvalIds.length === 0) {
    return;
  }

  await db.transaction(async (tx) => {
    const approvals = await tx
      .select({
        id: stockOutApprovals.id,
        sourceLocationId: stockOutApprovals.sourceLocationId,
      })
      .from(stockOutApprovals)
      .where(
        and(
          eq(stockOutApprovals.companyId, params.companyId),
          inArray(stockOutApprovals.id, approvalIds),
          eq(stockOutApprovals.status, "pending"),
        ),
      );

    if (approvals.length !== approvalIds.length) {
      throw new Error("One or more pending approval requests do not exist.");
    }

    for (const approval of approvals) {
      const canApprove = await userCanApproveLocation(tx, {
        companyId: params.companyId,
        userId: params.userId,
        locationId: approval.sourceLocationId,
      });

      if (!canApprove) {
        throw new Error("You are not assigned as an approver for this location.");
      }
    }

    const updatedApprovals = await tx
      .update(stockOutApprovals)
      .set({
        status: "approved",
        approverUserId: params.userId,
        approvedAt: new Date(),
        notes: params.notes ?? null,
        updatedAt: sql`now()`,
      })
      .where(and(eq(stockOutApprovals.companyId, params.companyId), inArray(stockOutApprovals.id, approvalIds)))
      .returning({
        id: stockOutApprovals.id,
        sourceType: stockOutApprovals.sourceType,
        sourceId: stockOutApprovals.sourceId,
        stockMovementId: stockOutApprovals.stockMovementId,
        sourceNo: stockOutApprovals.sourceNo,
        sourceLocationId: stockOutApprovals.sourceLocationId,
      });

    await tx.insert(auditLogs).values(
      updatedApprovals.map((approval) => ({
        companyId: params.companyId,
        actorUserId: params.userId,
        action: "stock_out_approval.approve",
        entityType: "stock_out_approval",
        entityId: approval.id,
        severity: "info" as const,
        metadata: approval,
      })),
    );
  });
}
