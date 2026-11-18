import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword, hashPassword } from "@/lib/auth/password";
import { loginSchema, zodFieldErrors } from "@/lib/auth/validators";
import { rateLimit } from "@/lib/rate-limit";
import { createSession, toSessionPayload } from "@/server/session";

/** Precomputed hash so a missing account costs the same as a wrong password. */
const DUMMY_HASH = hashPassword("comparaison-temps-constant");

/**
 * POST /api/auth/login
 * 200 { user, profile } · 401 INVALID_CREDENTIALS · 422 VALIDATION · 429 RATE_LIMITED · 500
 *
 * Adapted from Promethe src/app/api/auth/login/route.ts. Promethe calls
 * ensureUserSetup() after verifying the password (it creates a missing
 * Profile/defaults); Gaïa has no Profile table, so that step is dropped.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "VALIDATION",
          message: "Some fields are invalid.",
          fieldErrors: zodFieldErrors(parsed.error),
        },
        { status: 422 },
      );
    }

    const { email, password } = parsed.data;

    if (!rateLimit(`login:${email}`, 10, 5 * 60 * 1000)) {
      return NextResponse.json(
        {
          error: "RATE_LIMITED",
          message: "Too many attempts. Please try again in a few minutes.",
        },
        { status: 429 },
      );
    }

    const user = await db.user.findUnique({ where: { email } });
    const ok = verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !ok) {
      return NextResponse.json(
        {
          error: "INVALID_CREDENTIALS",
          message: "Incorrect email or password.",
        },
        { status: 401 },
      );
    }

    await createSession(user.id);

    // Opportunistic purge of expired sessions (cheap, keeps the table small).
    await db.authSession
      .deleteMany({ where: { expiresAt: { lt: new Date() } } })
      .catch(() => undefined);

    return NextResponse.json(toSessionPayload(user));
  } catch (error) {
    console.error("[api/auth/login] failed:", error);
    return NextResponse.json(
      { error: "INTERNAL", message: "An error occurred. Please try again." },
      { status: 500 },
    );
  }
}
