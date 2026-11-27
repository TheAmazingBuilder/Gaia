import { NextResponse } from "next/server";
import { requireUser } from "@/server/session";
import { apiError } from "@/server/api";
import { gaiaErrorResponse, getOrphanNotes } from "@/server/gaia";

/** GET /api/gaia/knowledge/orphans : notes sans aucune connexion. */
export async function GET() {
  try {
    const session = await requireUser();
    const result = await getOrphanNotes(session.user.id);
    return NextResponse.json(result);
  } catch (error) {
    return gaiaErrorResponse(error) ?? apiError(error, "gaia/knowledge/orphans");
  }
}
