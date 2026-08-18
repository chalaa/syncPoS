"use server";

import { redirect } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";

import { createSession, destroySession } from "@/server/auth/session";
import { verifyPassword } from "@/server/auth/password";
import { db } from "@/server/db/client";
import { companies, users } from "@/server/db/schema";

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

export async function login(formData: FormData) {
  const username = formValue(formData, "username");
  const password = formValue(formData, "password");

  const [user] = await db
    .select({
      id: users.id,
      passwordHash: users.passwordHash,
      status: users.status,
    })
    .from(users)
    .innerJoin(companies, eq(users.companyId, companies.id))
    .where(
      and(
        eq(companies.code, "SYNC"),
        eq(users.username, username),
        eq(users.status, "active"),
        isNull(users.deletedAt),
      ),
    )
    .limit(1);

  if (!user || !verifyPassword(password, user.passwordHash)) {
    redirect("/login?error=Invalid username or password");
  }

  await createSession(user.id);
  redirect("/admin/products");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
