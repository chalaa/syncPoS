import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  APP_TIMEZONE: z.string().default("Africa/Addis_Ababa"),
  APP_CURRENCY: z.string().default("ETB"),
});

export const env = envSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  APP_TIMEZONE: process.env.APP_TIMEZONE,
  APP_CURRENCY: process.env.APP_CURRENCY,
});
