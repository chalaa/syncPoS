import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { env } from "@/server/config/env";
import * as schema from "@/server/db/schema";

const queryClient = postgres(env.DATABASE_URL, {
  max: 10,
  prepare: false,
});

export const db = drizzle(queryClient, { schema });
