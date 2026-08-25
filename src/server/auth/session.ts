import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gt, isNull, or, sql } from "drizzle-orm";

import { db } from "@/server/db/client";
import {
  authSessions,
  permissions,
  rolePermissions,
  roles,
  userRoles,
  users,
} from "@/server/db/schema";
import { canonicalPermissionCodesFor, userHasPermission } from "@/server/iam/permissions";

const sessionCookieName = "syncpos_session";
const sessionDurationMs = 1000 * 60 * 60 * 8;
const maxActiveSessionsPerUser = 5;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + sessionDurationMs);
  const headerStore = await headers();
  const userAgent = headerStore.get("user-agent");
  const ipAddress =
    headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headerStore.get("x-real-ip") ??
    null;

  await db.insert(authSessions).values({
    userId,
    tokenHash,
    expiresAt,
    userAgent,
    ipAddress,
    rotatedAt: new Date(),
  });

  const activeSessions = await db
    .select({ id: authSessions.id })
    .from(authSessions)
    .where(and(eq(authSessions.userId, userId), isNull(authSessions.revokedAt), gt(authSessions.expiresAt, new Date())))
    .orderBy(authSessions.createdAt);

  const revokeSessions = activeSessions.slice(0, Math.max(activeSessions.length - maxActiveSessionsPerUser, 0));

  if (revokeSessions.length > 0) {
    await db
      .update(authSessions)
      .set({ revokedAt: new Date(), updatedAt: new Date() })
      .where(sql`${authSessions.id} in (${sql.join(revokeSessions.map((session) => sql`${session.id}`), sql`, `)})`);
  }

  const cookieStore = await cookies();
  cookieStore.set(sessionCookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName)?.value;

  if (token) {
    await db
      .update(authSessions)
      .set({ revokedAt: new Date(), updatedAt: new Date() })
      .where(eq(authSessions.tokenHash, hashToken(token)));
  }

  cookieStore.delete(sessionCookieName);
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName)?.value;

  if (!token) {
    return undefined;
  }

  const [sessionUser] = await db
    .select({
      id: users.id,
      companyId: users.companyId,
      username: users.username,
      email: users.email,
      status: users.status,
      lockedUntil: users.lockedUntil,
      sessionId: authSessions.id,
      expiresAt: authSessions.expiresAt,
    })
    .from(authSessions)
    .innerJoin(users, eq(authSessions.userId, users.id))
    .where(
      and(
        eq(authSessions.tokenHash, hashToken(token)),
        isNull(authSessions.revokedAt),
        gt(authSessions.expiresAt, new Date()),
        eq(users.status, "active"),
        or(isNull(users.lockedUntil), sql`${users.lockedUntil} <= now()`),
        isNull(users.deletedAt),
      ),
    )
    .limit(1);

  return sessionUser;
}

export async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

export async function getUserPermissionCodes(userId: string) {
  const rows = await db
    .select({ code: permissions.code })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .innerJoin(rolePermissions, eq(roles.id, rolePermissions.roleId))
    .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .where(
      and(
        eq(userRoles.userId, userId),
        or(isNull(userRoles.validFrom), sql`${userRoles.validFrom} <= now()`),
        or(isNull(userRoles.validTo), sql`${userRoles.validTo} > now()`),
        isNull(roles.deletedAt),
        isNull(permissions.deletedAt),
        eq(roles.isActive, true),
        eq(permissions.isActive, true),
      ),
    );

  return new Set(rows.flatMap((row) => canonicalPermissionCodesFor(row.code)));
}

export async function requirePermission(permissionCode: string) {
  const user = await requireUser();
  const permissions = await getUserPermissionCodes(user.id);

  if (!userHasPermission(permissions, permissionCode)) {
    redirect("/unauthorized");
  }

  return user;
}
