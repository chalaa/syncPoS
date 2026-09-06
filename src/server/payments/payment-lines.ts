import { and, eq, inArray, isNull, sql } from "drizzle-orm";

import { majorToMinor } from "@/server/catalog/products";
import { db } from "@/server/db/client";
import { paymentAccounts, paymentLines, paymentMethods } from "@/server/db/schema";
import type { PaymentDirection } from "@/server/payments/types";

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type PaymentLineInput = {
  lineNo: number;
  paymentMethodId: string;
  paymentAccountId: string;
  amountMinor: number;
  reference: string | null;
  note: string | null;
};

function stringValues(formData: FormData, key: string) {
  return formData.getAll(key).map((value) => (typeof value === "string" ? value.trim() : ""));
}

function legacyString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

export async function resolvePaymentLines(
  tx: DbTransaction,
  params: {
    formData: FormData;
    companyId: string;
    currencyCode: string;
    direction: PaymentDirection;
  },
): Promise<PaymentLineInput[]> {
  const accountIds = stringValues(params.formData, "linePaymentAccountId");
  const amounts = stringValues(params.formData, "lineAmount");
  const references = stringValues(params.formData, "lineReference");
  const notes = stringValues(params.formData, "lineNote");

  const rawLines = accountIds
    .map((paymentAccountId, index) => ({
      paymentAccountId,
      amount: amounts[index] ?? "",
      reference: references[index] ?? "",
      note: notes[index] ?? "",
    }))
    .filter((line) => line.paymentAccountId || line.amount || line.reference || line.note);

  if (rawLines.length === 0) {
    const paymentAccountId = legacyString(params.formData, "paymentAccountId");
    const amount = legacyString(params.formData, "amount");
    const reference = legacyString(params.formData, "reference");
    const note = legacyString(params.formData, "notes");

    if (paymentAccountId || amount || reference || note) {
      rawLines.push({ paymentAccountId, amount, reference, note });
    }
  }

  if (rawLines.length === 0) {
    throw new Error("Add at least one payment line.");
  }

  const uniqueAccountIds = Array.from(new Set(rawLines.map((line) => line.paymentAccountId).filter(Boolean)));

  if (uniqueAccountIds.length === 0) {
    throw new Error("Select a payment account for each payment line.");
  }

  const accountRows = await tx
    .select({
      id: paymentAccounts.id,
      currencyCode: paymentAccounts.currencyCode,
      methodId: paymentMethods.id,
      requiresReference: paymentMethods.requiresReference,
      allowInbound: paymentMethods.allowInbound,
      allowOutbound: paymentMethods.allowOutbound,
    })
    .from(paymentAccounts)
    .innerJoin(paymentMethods, eq(paymentAccounts.paymentMethodId, paymentMethods.id))
    .where(
      and(
        inArray(paymentAccounts.id, uniqueAccountIds),
        eq(paymentAccounts.companyId, params.companyId),
        eq(paymentAccounts.isActive, true),
        eq(paymentMethods.isActive, true),
        isNull(paymentAccounts.deletedAt),
        isNull(paymentMethods.deletedAt),
      ),
    );

  const accountById = new Map(accountRows.map((account) => [account.id, account]));

  return rawLines.map((line, index) => {
    if (!line.paymentAccountId) {
      throw new Error(`Select a payment account on line ${index + 1}.`);
    }

    const account = accountById.get(line.paymentAccountId);
    if (!account) {
      throw new Error(`Select an active payment account on line ${index + 1}.`);
    }

    if (params.direction === "inbound" && !account.allowInbound) {
      throw new Error(`Payment account on line ${index + 1} cannot receive customer payments.`);
    }

    if (params.direction === "outbound" && !account.allowOutbound) {
      throw new Error(`Payment account on line ${index + 1} cannot be used for outgoing payments.`);
    }

    if (account.currencyCode !== params.currencyCode) {
      throw new Error(`Payment account currency on line ${index + 1} must match ${params.currencyCode}.`);
    }

    const amountMinor = majorToMinor(line.amount);
    if (amountMinor <= 0) {
      throw new Error(`Amount on payment line ${index + 1} must be greater than zero.`);
    }

    if (account.requiresReference && !line.reference) {
      throw new Error(`Reference is required on payment line ${index + 1}.`);
    }

    return {
      lineNo: index + 1,
      paymentMethodId: account.methodId,
      paymentAccountId: account.id,
      amountMinor,
      reference: line.reference || null,
      note: line.note || null,
    };
  });
}

export function paymentLinesTotal(lines: PaymentLineInput[]) {
  return lines.reduce((sum, line) => sum + line.amountMinor, 0);
}

async function paymentLinesTableReady(tx: DbTransaction) {
  const [result] = await tx.execute<{ tableName: string | null; columnCount: number }>(sql`
    select
      to_regclass('public.payment_lines')::text as "tableName",
      (
        select count(*)::int
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'payment_lines'
          and column_name in (
            'id',
            'company_id',
            'payment_id',
            'line_no',
            'payment_method_id',
            'payment_account_id',
            'amount_minor',
            'reference',
            'note',
            'deleted_at',
            'deleted_by',
            'delete_reason',
            'created_at',
            'updated_at'
          )
      ) as "columnCount"
  `);

  return Boolean(result?.tableName) && result.columnCount >= 14;
}

export async function replacePaymentLines(
  tx: DbTransaction,
  params: {
    companyId: string;
    paymentId: string;
    lines: PaymentLineInput[];
  },
) {
  const tableReady = await paymentLinesTableReady(tx);

  if (!tableReady) {
    if (params.lines.length === 1) {
      return;
    }

    throw new Error("Payment line migration is not applied. Run pnpm db:migrate before using split payments.");
  }

  await tx
    .update(paymentLines)
    .set({
      deletedAt: sql`now()`,
      deleteReason: "Replaced by payment edit.",
      updatedAt: sql`now()`,
    })
    .where(and(eq(paymentLines.paymentId, params.paymentId), isNull(paymentLines.deletedAt)));

  await tx.insert(paymentLines).values(
    params.lines.map((line) => ({
      companyId: params.companyId,
      paymentId: params.paymentId,
      lineNo: line.lineNo,
      paymentMethodId: line.paymentMethodId,
      paymentAccountId: line.paymentAccountId,
      amountMinor: line.amountMinor,
      reference: line.reference,
      note: line.note,
    })),
  );
}
