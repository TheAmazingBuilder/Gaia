import { NextResponse } from "next/server";
import { getSession } from "@/server/session";

/**
 * GET /api/auth/me — current session.
 * 200 { user, profile } · 401 UNAUTHORIZED
 *
 * Copied from Promethe src/app/api/auth/me/route.ts (unchanged).
 */
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Session missing or expired." },
        { status: 401 },
      );
    }
    return NextResponse.json(session);
  } catch (error) {
    console.error("[api/auth/me] failed:", error);
    return NextResponse.json(
      { error: "INTERNAL", message: "An error occurred." },
      { status: 500 },
    );
  }
}
