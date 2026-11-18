/**
 * Server-side session management: opaque random token in an httpOnly cookie,
 * backed by the AuthSession table (revocable, 30-day expiry).
 * Server-only: imports next/headers — never bundle for the client.
 *
 * Adapted from Promethe src/server/session.ts. Same principle, simplified:
 * Promethe's getSession() loads User + Profile (separate table, id ===
 * users.id) and converts via toSessionPayload() in src/server/users.ts.
 * Gaïa has no Profile table — User carries displayName + timezone directly
 * (see prisma/schema.prisma) and the payload is synthesised here.
 */
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import type { SessionPayload } from "@/lib/auth/types";

export const SESSION_COOKIE = "gaia_session";
const SESSION_TTL_S = 30 * 24 * 60 * 60; // 30 days
const SESSION_TTL_MS = SESSION_TTL_S * 1000;

export class UnauthorizedError extends Error {
  constructor() {
    super("Not authenticated");
    this.name = "UnauthorizedError";
  }
}

type SessionUserRow = {
  id: string;
  email: string;
  displayName: string;
  timezone: string;
};

/** Synthesises the Promethe-shaped session payload from a User row. */
export function toSessionPayload(user: SessionUserRow): SessionPayload {
  return {
    user: { id: user.id, email: user.email },
    profile: {
      displayName: user.displayName,
      timezone: user.timezone,
      baseCurrency: "USD",
      locale: "en",
      theme: "dark",
      defaultAccountId: null,
      preferences: {},
      handle: null,
      publicDisplayName: null,
    },
  };
}

/** Creates a DB session and sets the httpOnly cookie. */
export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("hex");
  await db.authSession.create({
    data: { id: token, userId, expiresAt: new Date(Date.now() + SESSION_TTL_MS) },
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_S,
  });
}

/** Deletes the DB session (if any) and clears the cookie. */
export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.authSession
      .deleteMany({ where: { id: token } })
      .catch(() => undefined);
  }
  jar.delete(SESSION_COOKIE);
}

/**
 * Reads the current session (usable from RSC pages and route handlers).
 * Returns null when absent or expired — expired rows are purged on read.
 */
export async function getSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await db.authSession.findUnique({
    where: { id: token },
    include: { user: true },
  });
  if (!session) return null;

  if (session.expiresAt.getTime() <= Date.now()) {
    await db.authSession.delete({ where: { id: token } }).catch(() => undefined);
    return null;
  }

  return toSessionPayload(session.user);
}

/** Like getSession but throws UnauthorizedError - for data-access helpers. */
export async function requireUser(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) throw new UnauthorizedError();
  return session;
}
