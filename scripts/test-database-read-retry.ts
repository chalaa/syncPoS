import assert from "node:assert/strict";

import { withDatabaseReadRetry } from "../src/server/db/read-retry";

async function main() {
  let attempts = 0;
  const wrappedTimeout = Object.assign(new Error("Driver failure"), { code: "ETIMEDOUT" });
  const result = await withDatabaseReadRetry(async () => {
    attempts++;
    if (attempts === 1) throw new Error("Drizzle wrapper", { cause: new AggregateError([wrappedTimeout]) });
    return "connected";
  });
  assert.equal(result, "connected");
  assert.equal(attempts, 2);

  for (const code of ["42P01", "42703", "28P01", "23505", "40001"]) {
    attempts = 0;
    const permanent = new Error("Drizzle wrapper", { cause: Object.assign(new Error("Database error"), { code }) });
    await assert.rejects(withDatabaseReadRetry(async () => { attempts++; throw permanent; }), (error) => error === permanent);
    assert.equal(attempts, 1, `${code} must not be retried`);
  }

  attempts = 0;
  await assert.rejects(withDatabaseReadRetry(async () => { attempts++; throw wrappedTimeout; }), (error) => error === wrappedTimeout);
  assert.equal(attempts, 2, "Retries must stop after the second attempt");

  attempts = 0;
  const mixed = new AggregateError([wrappedTimeout, Object.assign(new Error("Missing column"), { code: "42703" })]);
  await assert.rejects(withDatabaseReadRetry(async () => { attempts++; throw mixed; }), (error) => error === mixed);
  assert.equal(attempts, 1);

  attempts = 0;
  const cycle: { cause?: unknown } = {};
  cycle.cause = cycle;
  await assert.rejects(withDatabaseReadRetry(async () => { attempts++; throw cycle; }), (error) => error === cycle);
  assert.equal(attempts, 1);
  assert.equal(await withDatabaseReadRetry(async () => undefined), undefined, "Missing sessions must stay missing");
  console.log("PASS read retry: nested timeouts recover, persistent failures stop, permanent errors and missing sessions are preserved.");
}

void main().catch((error) => { console.error(error); process.exitCode = 1; });
