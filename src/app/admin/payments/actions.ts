"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";

import { requirePermission, requireUser } from "@/server/auth/session";
import { getDefaultCompany } from "@/server/catalog/products";
import { db } from "@/server/db/client";
import { paymentAccounts, paymentLines, payments } from "@/server/db/schema";
import { verifyPaymentLineWithVerifyEt } from "@/server/payments/verify-et";

const verifyPaymentLineSchema = z.object({
  paymentLineId: z.string().uuid(),
  returnPath: z.string().trim().startsWith("/admin/"),
});

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value : "";
}

function redirectWithMessage(path: string, key: "notice" | "error", message: string): never {
  const separator = path.includes("?") ? "&" : "?";

  redirect(`${path}${separator}${key}=${encodeURIComponent(message)}`);
}

export async function verifyPaymentLine(formData: FormData) {
  const user = await requireUser();
  const parsed = verifyPaymentLineSchema.safeParse({
    paymentLineId: formValue(formData, "paymentLineId"),
    returnPath: formValue(formData, "returnPath"),
  });

  if (!parsed.success) {
    redirectWithMessage("/admin", "error", "Payment line ID is required.");
  }

  const company = await getDefaultCompany();
  const [line] = await db
    .select({
      id: paymentLines.id,
      paymentId: paymentLines.paymentId,
      reference: paymentLines.reference,
      amountMinor: paymentLines.amountMinor,
      paymentType: payments.paymentType,
      status: payments.status,
      currencyCode: payments.currencyCode,
      verifyEtEnabled: paymentAccounts.verifyEtEnabled,
      verifyEtBank: paymentAccounts.verifyEtBank,
      verifyEtSettlementAccount: paymentAccounts.verifyEtSettlementAccount,
    })
    .from(paymentLines)
    .innerJoin(payments, eq(paymentLines.paymentId, payments.id))
    .innerJoin(paymentAccounts, eq(paymentLines.paymentAccountId, paymentAccounts.id))
    .where(
      and(
        eq(paymentLines.id, parsed.data.paymentLineId),
        eq(paymentLines.companyId, company.id),
        isNull(paymentLines.deletedAt),
        isNull(payments.deletedAt),
      ),
    )
    .limit(1);

  if (!line) {
    redirectWithMessage(parsed.data.returnPath, "error", "Payment line does not exist.");
  }

  if (line.paymentType === "inbound") {
    await requirePermission("sales:orders:create");
  } else {
    await requirePermission("inventory.receive");
  }

  if (line.status !== "draft") {
    redirectWithMessage(parsed.data.returnPath, "error", "Only draft payment lines can be verified.");
  }

  if (!line.verifyEtEnabled) {
    redirectWithMessage(parsed.data.returnPath, "error", "Verify.ET is not enabled for this payment account.");
  }

  if (!line.verifyEtBank) {
    redirectWithMessage(parsed.data.returnPath, "error", "Select a Verify.ET bank on the payment account first.");
  }

  try {
    await verifyPaymentLineWithVerifyEt({
      companyId: company.id,
      actorUserId: user.id,
      paymentLine: line,
      currencyCode: line.currencyCode,
      bank: line.verifyEtBank,
      settlementAccount: line.verifyEtSettlementAccount,
    });
  } catch (error) {
    revalidatePath(parsed.data.returnPath);
    redirectWithMessage(
      parsed.data.returnPath,
      "error",
      error instanceof Error ? error.message : "Could not verify payment line.",
    );
  }

  revalidatePath(parsed.data.returnPath);
  redirectWithMessage(parsed.data.returnPath, "notice", "Payment line verified.");
}
