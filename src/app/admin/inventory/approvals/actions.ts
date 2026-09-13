"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { getUserPermissionCodes, requireUser } from "@/server/auth/session";
import { getDefaultCompany } from "@/server/catalog/products";
import { db } from "@/server/db/client";
import { auditLogs, stockOutApprovals } from "@/server/db/schema";
import { userCanApproveLocation } from "@/server/inventory/stock-approvals";
import { PERMISSIONS, userHasPermission } from "@/server/iam/permissions";

const approvalSchema = z.object({
  approvalId: z.string().uuid(),
  notes: z.string().trim().max(500).optional(),
});

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value : "";
}

function redirectWithMessage(key: "notice" | "error", message: string): never {
  redirect(`/admin/inventory/approvals?${key}=${encodeURIComponent(message)}`);
}

async function assertCanApprove(companyId: string, userId: string, locationId: string) {
  const permissionCodes = await getUserPermissionCodes(userId);

  if (userHasPermission(permissionCodes, PERMISSIONS.COMPANY.MANAGE)) {
    return;
  }

  if (!userHasPermission(permissionCodes, PERMISSIONS.INVENTORY.TRANSFER_APPROVE)) {
    redirect("/unauthorized");
  }

  const canApprove = await db.transaction((tx) =>
    userCanApproveLocation(tx, {
      companyId,
      userId,
      locationId,
    }),
  );

  if (!canApprove) {
    throw new Error("You are not assigned as an approver for this location.");
  }
}

export async function approveStockOutRequest(formData: FormData) {
  const user = await requireUser();
  const parsed = approvalSchema.safeParse({
    approvalId: formValue(formData, "approvalId"),
    notes: formValue(formData, "notes"),
  });

  if (!parsed.success) {
    redirectWithMessage("error", "Approval request is required.");
  }

  const company = await getDefaultCompany();

  try {
    const [approval] = await db
      .select({
        id: stockOutApprovals.id,
        sourceLocationId: stockOutApprovals.sourceLocationId,
      })
      .from(stockOutApprovals)
      .where(and(eq(stockOutApprovals.id, parsed.data.approvalId), eq(stockOutApprovals.companyId, company.id), eq(stockOutApprovals.status, "pending")))
      .limit(1);

    if (!approval) {
      throw new Error("Pending approval request does not exist.");
    }

    await assertCanApprove(company.id, user.id, approval.sourceLocationId);

    await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(stockOutApprovals)
        .set({
          status: "approved",
          approverUserId: user.id,
          approvedAt: new Date(),
          notes: parsed.data.notes || null,
          updatedAt: sql`now()`,
        })
        .where(and(eq(stockOutApprovals.id, parsed.data.approvalId), eq(stockOutApprovals.companyId, company.id), eq(stockOutApprovals.status, "pending")))
        .returning({
          id: stockOutApprovals.id,
          sourceType: stockOutApprovals.sourceType,
          sourceId: stockOutApprovals.sourceId,
          stockMovementId: stockOutApprovals.stockMovementId,
          sourceNo: stockOutApprovals.sourceNo,
          sourceLocationId: stockOutApprovals.sourceLocationId,
        });

      if (!updated) {
        throw new Error("Pending approval request does not exist.");
      }

      await tx.insert(auditLogs).values({
        companyId: company.id,
        actorUserId: user.id,
        action: "stock_out_approval.approve",
        entityType: "stock_out_approval",
        entityId: updated.id,
        severity: "info",
        metadata: updated,
      });
    });
  } catch (error) {
    redirectWithMessage("error", error instanceof Error ? error.message : "Could not approve request.");
  }

  revalidatePath("/admin/inventory/approvals");
  redirectWithMessage("notice", "Stock-out request approved");
}

export async function rejectStockOutRequest(formData: FormData) {
  const user = await requireUser();
  const parsed = approvalSchema.safeParse({
    approvalId: formValue(formData, "approvalId"),
    notes: formValue(formData, "notes"),
  });

  if (!parsed.success) {
    redirectWithMessage("error", "Approval request is required.");
  }

  const company = await getDefaultCompany();

  try {
    const [approval] = await db
      .select({
        id: stockOutApprovals.id,
        sourceLocationId: stockOutApprovals.sourceLocationId,
      })
      .from(stockOutApprovals)
      .where(and(eq(stockOutApprovals.id, parsed.data.approvalId), eq(stockOutApprovals.companyId, company.id), eq(stockOutApprovals.status, "pending")))
      .limit(1);

    if (!approval) {
      throw new Error("Pending approval request does not exist.");
    }

    await assertCanApprove(company.id, user.id, approval.sourceLocationId);

    await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(stockOutApprovals)
        .set({
          status: "rejected",
          approverUserId: user.id,
          rejectedAt: new Date(),
          notes: parsed.data.notes || null,
          updatedAt: sql`now()`,
        })
        .where(and(eq(stockOutApprovals.id, parsed.data.approvalId), eq(stockOutApprovals.companyId, company.id), eq(stockOutApprovals.status, "pending")))
        .returning({
          id: stockOutApprovals.id,
          sourceType: stockOutApprovals.sourceType,
          sourceId: stockOutApprovals.sourceId,
          stockMovementId: stockOutApprovals.stockMovementId,
          sourceNo: stockOutApprovals.sourceNo,
          sourceLocationId: stockOutApprovals.sourceLocationId,
        });

      if (!updated) {
        throw new Error("Pending approval request does not exist.");
      }

      await tx.insert(auditLogs).values({
        companyId: company.id,
        actorUserId: user.id,
        action: "stock_out_approval.reject",
        entityType: "stock_out_approval",
        entityId: updated.id,
        severity: "warning",
        metadata: updated,
      });
    });
  } catch (error) {
    redirectWithMessage("error", error instanceof Error ? error.message : "Could not reject request.");
  }

  revalidatePath("/admin/inventory/approvals");
  redirectWithMessage("notice", "Stock-out request rejected");
}
