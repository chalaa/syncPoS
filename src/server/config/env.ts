import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  APP_TIMEZONE: z.string().default("Africa/Addis_Ababa"),
  APP_CURRENCY: z.string().default("ETB"),
  VERIFY_ET_BASE_URL: z.string().url().default("https://verify.et"),
  VERIFY_ET_API_KEY: z.string().optional(),
});

export const env = envSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  APP_TIMEZONE: process.env.APP_TIMEZONE,
  APP_CURRENCY: process.env.APP_CURRENCY,
  VERIFY_ET_BASE_URL: process.env.VERIFY_ET_BASE_URL,
  VERIFY_ET_API_KEY: process.env.VERIFY_ET_API_KEY,
});
