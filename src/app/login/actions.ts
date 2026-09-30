"use server";

import { redirect } from "next/navigation";
import { and, eq, isNull, or } from "drizzle-orm";

import { createSession, destroySession } from "@/server/auth/session";
import { verifyPassword } from "@/server/auth/password";
import { db } from "@/server/db/client";
import { companies, employees, users } from "@/server/db/schema";
import { normalizePhoneNumber } from "@/lib/phone-utils";

const maxLoginAttempts = 5;
const lockDurationMs = 15 * 60 * 1000;

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

export async function login(formData: FormData) {
  const phoneInput = formValue(formData, "phone") || formValue(formData, "username");
  const password = formValue(formData, "password");

  if (!phoneInput || !password) {
    redirect("/login?error=Phone number and password are required.");
  }

  const normalizedInput = normalizePhoneNumber(phoneInput);

  const [user] = await db
    .select({
      id: users.id,
      passwordHash: users.passwordHash,
      status: users.status,
      failedLoginAttempts: users.failedLoginAttempts,
      lockedUntil: users.lockedUntil,
    })
    .from(users)
    .innerJoin(companies, eq(users.companyId, companies.id))
    .leftJoin(employees, eq(users.employeeId, employees.id))
    .where(
      and(
        eq(companies.code, "SYNC"),
        eq(users.status, "active"),
        isNull(users.deletedAt),
        or(
          eq(users.phone, phoneInput),
          eq(users.normalizedPhone, normalizedInput),
          eq(employees.phone, phoneInput),
          eq(users.username, phoneInput),
          eq(users.username, normalizedInput)
        ),
      ),
    )
    .limit(1);

  if (user?.lockedUntil && user.lockedUntil > new Date()) {
    redirect("/login?error=Account is temporarily locked. Try again later.");
  }

  if (!user || !verifyPassword(password, user.passwordHash)) {
    if (user) {
      const nextAttempts = user.failedLoginAttempts + 1;
      await db
        .update(users)
        .set({
          failedLoginAttempts: nextAttempts,
          lockedUntil: nextAttempts >= maxLoginAttempts ? new Date(Date.now() + lockDurationMs) : null,
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id));
    }

    redirect("/login?error=Invalid phone number or password");
  }

  await db
    .update(users)
    .set({
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  await createSession(user.id);
  redirect("/admin/products");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
