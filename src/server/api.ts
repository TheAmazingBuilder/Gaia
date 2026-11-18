/**
 * Shared API error mapping — every route handler wraps its body with the same
 * try/catch so typed errors (unauthorized, validation, not found) map to
 * consistent envelopes and raw Prisma/provider errors NEVER reach the client.
 *
 * Minimal Gaïa-only equivalent of Promethe src/server/api.ts. Promethe's
 * version maps a dozen module-specific validation error classes; Gaïa only
 * has GaiaError (handled by gaiaErrorResponse in src/server/gaia.ts) plus
 * UnauthorizedError, so this file only handles those two cases.
 */
import { NextResponse } from "next/server";
import { UnauthorizedError } from "@/server/session";

export function apiError(error: unknown, route: string): NextResponse {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json(
      { error: "UNAUTHORIZED", message: "Session missing or expired." },
      { status: 401 },
    );
  }
  console.error(`[api/${route}] failed:`, error);
  return NextResponse.json(
    { error: "INTERNAL", message: "An error occurred. Please try again." },
    { status: 500 },
  );
}
