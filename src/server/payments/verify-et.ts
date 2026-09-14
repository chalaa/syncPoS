import "server-only";

import { createHash } from "node:crypto";

import { desc, eq, sql } from "drizzle-orm";

import { env } from "@/server/config/env";
import { db } from "@/server/db/client";
import { auditLogs, paymentLineVerifications, type paymentLines } from "@/server/db/schema";

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type PaymentLineRecord = typeof paymentLines.$inferSelect;

type VerifyEtBody = {
  bank: string;
  reference?: string;
  referenceNumber?: string;
  transactionNumber?: string;
  receiptNumber?: string;
  accountSuffix?: string;
  suffix?: string;
  settlementAccount?: string;
};

type VerificationInput = {
  companyId: string;
  actorUserId: string;
  paymentLine: Pick<PaymentLineRecord, "id" | "reference" | "amountMinor">;
  currencyCode: string;
  bank: string;
  settlementAccount: string | null;
};

function idempotencyKey(input: VerificationInput) {
  return createHash("sha256")
    .update([input.paymentLine.id, input.paymentLine.reference ?? "", input.paymentLine.amountMinor].join(":"))
    .digest("hex");
}

function suffixFor(bank: string, settlementAccount: string | null) {
  if (!settlementAccount) {
    return undefined;
  }

  const digits = settlementAccount.replace(/\D/g, "");
  if (bank === "cbe" && digits.length >= 8) {
    return digits.slice(-8);
  }
  if (bank === "boa" && digits.length >= 5) {
    return digits.slice(-5);
  }

  return undefined;
}

function buildBody(input: VerificationInput): VerifyEtBody {
  const bank = input.bank.trim().toLowerCase();
  const reference = input.paymentLine.reference?.trim() ?? "";
  const suffix = suffixFor(bank, input.settlementAccount);
  const body: VerifyEtBody = {
    bank,
    reference,
    settlementAccount: input.settlementAccount ?? undefined,
  };

  if (["telebirr", "mpesa"].includes(bank)) {
    body.transactionNumber = reference;
  } else if (bank === "cbebirr") {
    body.receiptNumber = reference;
  } else {
    body.referenceNumber = reference;
  }

  if (suffix) {
    body.accountSuffix = suffix;
    body.suffix = suffix;
  }

  return body;
}

function normalizeAmountMinor(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value * 100);
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? Math.round(parsed * 100) : null;
  }

  return null;
}

function firstResult(responseBody: unknown) {
  if (!responseBody || typeof responseBody !== "object") {
    return {};
  }

  const data = "data" in responseBody ? (responseBody as { data?: unknown }).data : undefined;
  if (Array.isArray(data)) {
    return data[0] && typeof data[0] === "object" ? data[0] as Record<string, unknown> : {};
  }
  if (data && typeof data === "object") {
    return data as Record<string, unknown>;
  }

  return {};
}

function responseVerification(responseBody: unknown) {
  if (responseBody && typeof responseBody === "object" && "verification" in responseBody) {
    const verification = (responseBody as { verification?: unknown }).verification;
    return verification && typeof verification === "object" ? verification as Record<string, unknown> : {};
  }

  return {};
}

function stringField(source: Record<string, unknown>, key: string) {
  const value = source[key];

  return typeof value === "string" ? value : null;
}

function booleanField(source: Record<string, unknown>, key: string) {
  const value = source[key];

  return typeof value === "boolean" ? value : null;
}

export async function verifyPaymentLineWithVerifyEt(input: VerificationInput) {
  if (!env.VERIFY_ET_API_KEY) {
    throw new Error("VERIFY_ET_API_KEY is not configured.");
  }

  const body = buildBody(input);
  if (!body.reference) {
    throw new Error("Reference is required before Verify.ET verification.");
  }

  const baseUrl = env.VERIFY_ET_BASE_URL.replace(/\/$/, "");
  const url = `${baseUrl}/api/verify?waitMs=5000`;
  const headers = {
    "Content-Type": "application/json",
    "x-api-key": env.VERIFY_ET_API_KEY,
    "Idempotency-Key": idempotencyKey(input),
  };
  const auditHeaders = {
    "Content-Type": "application/json",
    "x-api-key": "[redacted]",
    "Idempotency-Key": headers["Idempotency-Key"],
  };

  await db.insert(auditLogs).values({
    companyId: input.companyId,
    actorUserId: input.actorUserId,
    action: "verify_et.request",
    entityType: "payment_line",
    entityId: input.paymentLine.id,
    severity: "info",
    metadata: { url, method: "POST", headers: auditHeaders, body },
  });

  let response: Response;
  let responseBody: unknown;

  try {
    response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      cache: "no-store",
    });
    responseBody = await response.json().catch(() => ({}));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Verify.ET request failed.";

    await db.insert(auditLogs).values({
      companyId: input.companyId,
      actorUserId: input.actorUserId,
      action: "verify_et.error",
      entityType: "payment_line",
      entityId: input.paymentLine.id,
      severity: "warning",
      metadata: { url, method: "POST", request: { headers: auditHeaders, body }, error: message },
    });

    throw new Error(`Verify.ET request failed: ${message}`);
  }

  await db.insert(auditLogs).values({
    companyId: input.companyId,
    actorUserId: input.actorUserId,
    action: "verify_et.response",
    entityType: "payment_line",
    entityId: input.paymentLine.id,
    severity: response.ok ? "info" : "warning",
    metadata: {
      url,
      method: "POST",
      request: { headers: auditHeaders, body },
      response: { status: response.status, body: responseBody },
    },
  });

  const result = firstResult(responseBody);
  const verification = responseVerification(responseBody);
  const requestId =
    stringField(verification, "requestId") ??
    (responseBody && typeof responseBody === "object" ? stringField(responseBody as Record<string, unknown>, "requestId") : null);
  const settlementMatch = result.settlementAccountMatch && typeof result.settlementAccountMatch === "object"
    ? result.settlementAccountMatch as Record<string, unknown>
    : {};
  const verified = booleanField(verification, "verified") ?? booleanField(result, "verified") ?? false;
  const providerStatus = stringField(verification, "status") ?? stringField(result, "status");
  const processingStatus = stringField(verification, "processingStatus");
  const status = verified ? "verified" : processingStatus === "queued" || processingStatus === "running" ? "pending" : "failed";
  const errorMessage = status === "failed"
    ? (responseBody && typeof responseBody === "object" ? stringField(responseBody as Record<string, unknown>, "message") : null) ?? providerStatus ?? "Verification failed."
    : null;
  const amountMinor = normalizeAmountMinor(result.amount);
  const settlementMatched = booleanField(settlementMatch, "matched");

  await db.insert(paymentLineVerifications).values({
    companyId: input.companyId,
    paymentLineId: input.paymentLine.id,
    provider: "verify_et",
    providerRequestId: requestId,
    bank: body.bank,
    reference: body.reference,
    settlementAccount: input.settlementAccount,
    status,
    verified,
    amountMinor,
    currencyCode: stringField(result, "currency"),
    senderName: stringField(result, "senderName"),
    receiverName: stringField(result, "receiverName"),
    receiverAccount: stringField(result, "receiverAccount"),
    settlementMatched,
    rawResponse: responseBody,
    errorMessage,
    verifiedAt: status === "verified" ? new Date() : null,
  });

  if (!response.ok) {
    throw new Error(errorMessage ?? `Verify.ET returned ${response.status}.`);
  }

  if (status !== "verified") {
    throw new Error(errorMessage ?? "Verify.ET verification is pending or failed.");
  }

  if (amountMinor !== null && amountMinor !== input.paymentLine.amountMinor) {
    throw new Error("Verified amount does not match the payment line amount.");
  }

  if (stringField(result, "currency") && stringField(result, "currency") !== input.currencyCode) {
    throw new Error("Verified currency does not match the payment currency.");
  }

  if (input.settlementAccount && settlementMatched === false) {
    throw new Error("Verified receipt was not paid to the configured settlement account.");
  }
}

export async function getPaymentVerificationWarnings(
  tx: DbTransaction,
  params: {
    companyId: string;
    paymentId: string;
  },
): Promise<string[]> {
  const rows = await tx.execute<{
    lineNo: number;
    reference: string | null;
    amountMinor: number;
    currencyCode: string;
    verifyEtEnabled: boolean;
    status: "pending" | "verified" | "failed" | null;
    verifiedAmountMinor: number | null;
    verifiedCurrencyCode: string | null;
    settlementMatched: boolean | null;
  }>(sql`
    select
      pl.line_no as "lineNo",
      pl.reference as "reference",
      pl.amount_minor as "amountMinor",
      p.currency_code as "currencyCode",
      pa.verify_et_enabled as "verifyEtEnabled",
      latest.status::text as "status",
      latest.amount_minor as "verifiedAmountMinor",
      latest.currency_code as "verifiedCurrencyCode",
      latest.settlement_matched as "settlementMatched"
    from payment_lines pl
    inner join payments p on p.id = pl.payment_id
    inner join payment_accounts pa on pa.id = pl.payment_account_id
    left join lateral (
      select status, amount_minor, currency_code, settlement_matched
      from payment_line_verifications plv
      where plv.payment_line_id = pl.id
      order by plv.created_at desc
      limit 1
    ) latest on true
    where pl.payment_id = ${params.paymentId}
      and pl.company_id = ${params.companyId}
      and pl.deleted_at is null
      and pa.verify_et_enabled = true
    order by pl.line_no
  `);

  const warnings: string[] = [];

  for (const row of rows) {
    if (!row.reference) {
      warnings.push(`Reference is missing on payment line ${row.lineNo}.`);
    }
    if (row.status !== "verified") {
      warnings.push(`Payment line ${row.lineNo} is not verified.`);
    }
    if (row.verifiedAmountMinor !== null && row.verifiedAmountMinor !== row.amountMinor) {
      warnings.push(`Verified amount does not match payment line ${row.lineNo}.`);
    }
    if (row.verifiedCurrencyCode && row.verifiedCurrencyCode !== row.currencyCode) {
      warnings.push(`Verified currency does not match payment line ${row.lineNo}.`);
    }
    if (row.settlementMatched === false) {
      warnings.push(`Settlement account does not match on payment line ${row.lineNo}.`);
    }
  }

  return warnings;
}

export async function latestPaymentLineVerification(paymentLineId: string) {
  const [row] = await db
    .select()
    .from(paymentLineVerifications)
    .where(eq(paymentLineVerifications.paymentLineId, paymentLineId))
    .orderBy(desc(paymentLineVerifications.createdAt))
    .limit(1);

  return row;
}
