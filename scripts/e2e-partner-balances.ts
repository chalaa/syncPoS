import "dotenv/config";

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { getPartnerOrderBalances } from "../src/server/partners/order-balances";
import { getArchivedModelRows } from "../src/server/archived/model-archives";
import * as s from "../src/server/db/schema";

const client = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });
const database = drizzle(client, { schema: s });
const rollback = new Error("Rollback partner balance fixtures");

async function main() {
  try {
    await database.transaction(async (tx) => {
      await tx.insert(s.currencies).values([{ code: "ETB", name: "Ethiopian Birr" }, { code: "USD", name: "US Dollar" }]).onConflictDoNothing();
      const [company] = await tx.insert(s.companies).values({ code: `BAL-${randomUUID().slice(0, 8)}`, legalName: "Partner balance tests", baseCurrencyCode: "ETB" }).returning();
      const [partner, otherPartner] = await tx.insert(s.partners).values(["Target", "Other"].map((displayName) => ({ companyId: company.id, code: displayName, displayName, isCustomer: true, isSupplier: true, currencyCode: "ETB" }))).returning();
      const [ownerA, ownerB, unusedOwner] = await tx.insert(s.owners).values(["Owner A", "Owner B", "Unused owner"].map((name) => ({ companyId: company.id, name }))).returning();
      const [method] = await tx.insert(s.paymentMethods).values({ companyId: company.id, code: "CASH", name: "Cash", methodType: "cash", allowOutbound: true }).returning();
      const [account] = await tx.insert(s.paymentAccounts).values({ companyId: company.id, paymentMethodId: method.id, code: "CASH", name: "Cash", currencyCode: "ETB" }).returning();

      async function sale(ownerId: string | null, totalMinor: number, status: "confirmed" | "quotation" | "cancelled" = "confirmed", currencyCode = "ETB", customerId = partner.id) {
        const [row] = await tx.insert(s.salesOrders).values({ companyId: company.id, customerId, ownerId, orderNo: randomUUID(), currencyCode, totalMinor, status, confirmedAt: status === "confirmed" ? new Date() : null }).returning();
        return row;
      }
      async function purchase(ownerId: string | null, totalMinor: number, status: "confirmed" | "draft" | "cancelled" = "confirmed") {
        const [row] = await tx.insert(s.purchaseOrders).values({ companyId: company.id, supplierId: partner.id, ownerId, orderNo: randomUUID(), currencyCode: "ETB", totalMinor, status }).returning();
        return row;
      }
      async function pay(orderId: string, amountMinor: number, outbound = false, status: "draft" | "posted" | "cancelled" = "posted", archived = false, allocationArchived = false) {
        const [payment] = await tx.insert(s.payments).values({ companyId: company.id, partnerId: partner.id, paymentNo: randomUUID(), paymentType: outbound ? "outbound" : "inbound", paymentMethodId: method.id, paymentAccountId: account.id, amountMinor, currencyCode: "ETB", status, postedAt: status === "posted" ? new Date() : null, cancelledAt: status === "cancelled" ? new Date() : null, deletedAt: archived ? new Date() : null }).returning();
        await tx.insert(s.paymentAllocations).values({ paymentId: payment.id, salesOrderId: outbound ? null : orderId, purchaseOrderId: outbound ? orderId : null, amountMinor, deletedAt: allocationArchived ? new Date() : null });
        return payment;
      }

      const saleA = await sale(ownerA.id, 10000);
      const purchaseA = await purchase(ownerA.id, 9000);
      await pay(saleA.id, 3000);
      await pay(purchaseA.id, 4000, true);
      const saleB = await sale(ownerB.id, 6000);
      await pay(saleB.id, 9000); // A historical overpayment must not create a negative unpaid amount.
      await sale(null, 2000);
      await sale(ownerA.id, 100000, "quotation");
      await sale(ownerA.id, 100000, "cancelled");
      await purchase(ownerA.id, 100000, "draft");
      await purchase(ownerA.id, 100000, "cancelled");
      await sale(ownerA.id, 100000, "confirmed", "ETB", otherPartner.id);
      await sale(ownerA.id, 700, "confirmed", "USD");
      const archivedOrder = await sale(ownerB.id, 50000);
      await tx.update(s.salesOrders).set({ deletedAt: new Date() }).where(eq(s.salesOrders.id, archivedOrder.id));
      await pay(saleA.id, 1000, false, "draft");
      await pay(saleA.id, 1000, false, "cancelled");
      await pay(saleA.id, 1000, false, "posted", true);
      await pay(saleA.id, 1000, false, "posted", false, true);

      const summary = await getPartnerOrderBalances(company.id, partner.id, "ETB", 20000, tx);
      const a = summary.byOwner.find((row) => row.ownerId === ownerA.id && row.currencyCode === "ETB")!;
      assert.equal(a.receivableResidualMinor, 7000);
      assert.equal(a.payableResidualMinor, 5000);
      assert.equal(a.netBalanceMinor, 2000);
      assert.equal(a.salesCount, 3);
      assert.equal(a.purchaseCount, 3);
      assert.equal(summary.byOwner.find((row) => row.ownerId === ownerB.id)!.receivableResidualMinor, 0);
      assert.equal(summary.byOwner.find((row) => row.ownerId === unusedOwner.id)!.salesCount, 0);
      assert.equal(summary.byOwner.find((row) => row.ownerId === null)!.receivableResidualMinor, 2000);
      assert.equal(summary.byOwner.find((row) => row.currencyCode === "USD")!.receivableResidualMinor, 700);
      assert.equal(summary.receivableResidualMinor, 9000);
      assert.equal(summary.payableResidualMinor, 5000);
      assert.equal(summary.netBalanceMinor, 4000);
      assert.equal(summary.remainingCreditMinor, 11000);
      assert.equal(summary.salesCount, 6);
      assert.equal(summary.purchaseCount, 3);
      console.log("PASS owner balances, posted order allocations, draft/cancelled exclusions, overpayment clamp, unassigned orders and currency isolation");

      const noCredit = await getPartnerOrderBalances(company.id, partner.id, "ETB", 1000, tx);
      assert.equal(noCredit.remainingCreditMinor, 0);
      const unrelated = await getPartnerOrderBalances(company.id, otherPartner.id, "ETB", 0, tx);
      assert.equal(unrelated.receivableResidualMinor, 100000);
      const wrongCompany = await getPartnerOrderBalances(randomUUID(), partner.id, "ETB", 0, tx);
      assert.equal(wrongCompany.salesCount, 0);
      assert.equal(wrongCompany.receivableResidualMinor, 0);
      console.log("PASS shared credit limit, partner and company isolation");

      const archivedRows = await getArchivedModelRows("sales_order", company.id, { partnerId: partner.id, ownerId: ownerB.id, currencyCode: "ETB", locationId: "all" }, tx);
      assert.deepEqual(archivedRows.map((row) => row.id), [archivedOrder.id]);
      assert.equal((await getArchivedModelRows("sales_order", company.id, { partnerId: otherPartner.id, locationId: "all" }, tx)).length, 0);
      assert.equal((await getArchivedModelRows("sales_order", company.id, { ownerId: ownerA.id, locationId: "all" }, tx)).length, 0);
      assert.equal((await getArchivedModelRows("sales_order", company.id, { currencyCode: "USD", locationId: "all" }, tx)).length, 0);
      console.log("PASS partner, owner and currency filters remain applied in order archives");

      await tx.update(s.owners).set({ deletedAt: new Date() }).where(eq(s.owners.id, ownerA.id));
      const historical = await getPartnerOrderBalances(company.id, partner.id, "ETB", 20000, tx);
      assert.equal(historical.receivableResidualMinor, summary.receivableResidualMinor);
      assert(historical.byOwner.some((row) => row.ownerId === ownerA.id));
      await tx.update(s.salesOrders).set({ deletedAt: new Date() }).where(eq(s.salesOrders.id, saleA.id));
      const archived = await getPartnerOrderBalances(company.id, partner.id, "ETB", 20000, tx);
      assert.equal(archived.receivableResidualMinor, 2000);
      await tx.update(s.salesOrders).set({ deletedAt: null }).where(eq(s.salesOrders.id, saleA.id));
      const restored = await getPartnerOrderBalances(company.id, partner.id, "ETB", 20000, tx);
      assert.equal(restored.receivableResidualMinor, 9000);
      console.log("PASS archived owners retain existing balances; archiving and restoring orders updates exposure");
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  } finally {
    await client.end();
  }
  console.log("Partner balance checks passed; all fixtures rolled back.");
}

void main().catch((error) => { console.error(error); process.exitCode = 1; });
