import { NextResponse } from "next/server";
import { GaiaError } from "@/shared/errors/gaia-error";

/**
 * Convertit une GaiaError en réponse HTTP ({ error, code?, message?, issues? }).
 * Retourne null pour les autres erreurs (à passer à apiError).
 */
export function gaiaErrorResponse(error: unknown): NextResponse | null {
  if (!(error instanceof GaiaError)) return null;
  return NextResponse.json(
    {
      error: error.error,
      code: error.code,
      message: error.message,
      ...(error.issues ? { issues: error.issues } : {}),
    },
    { status: error.status },
  );
}
