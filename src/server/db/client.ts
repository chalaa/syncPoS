import { getDefaultAutoSelectFamilyAttemptTimeout, setDefaultAutoSelectFamilyAttemptTimeout } from "node:net";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { env } from "@/server/config/env";
import * as schema from "@/server/db/schema";

// Node's 250ms address-attempt timeout can expire before a remote TCP handshake.
if (getDefaultAutoSelectFamilyAttemptTimeout() < 2_000) {
  setDefaultAutoSelectFamilyAttemptTimeout(2_000);
}

const postgresGlobal = globalThis as typeof globalThis & {
  syncposPostgres?: { databaseUrl: string; client: ReturnType<typeof postgres> };
};
const previous = postgresGlobal.syncposPostgres;
const queryClient = previous?.databaseUrl === env.DATABASE_URL
  ? previous.client
  : postgres(env.DATABASE_URL, {
      max: 10,
      prepare: false,
      connect_timeout: 30,
      idle_timeout: 20,
      max_lifetime: 60 * 30,
    });

postgresGlobal.syncposPostgres = { databaseUrl: env.DATABASE_URL, client: queryClient };
if (process.env.NODE_ENV === "development" && previous?.client !== queryClient) {
  const target = new URL(env.DATABASE_URL);
  console.info(`[database] Connecting to ${target.hostname}:${target.port || "5432"}/${target.pathname.slice(1)}`);
}
if (previous && previous.client !== queryClient) {
  void previous.client.end().catch(() => undefined);
}

export const db = drizzle(queryClient, { schema });
