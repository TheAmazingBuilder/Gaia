import { NextResponse } from "next/server";
import { requireUser } from "@/server/session";
import { apiError } from "@/server/api";
import {
  gaiaErrorResponse,
  getWritingSettings,
  updateWritingSettings,
} from "@/server/gaia";

/**
 * GET /api/gaia/settings : objectifs d'écriture (Module 1, E12).
 * PATCH /api/gaia/settings { dailyWordGoal } : mettre à jour l'objectif quotidien.
 */
export async function GET() {
  try {
    const session = await requireUser();
    return NextResponse.json(await getWritingSettings(session.user.id));
  } catch (error) {
    return gaiaErrorResponse(error) ?? apiError(error, "gaia/settings");
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await requireUser();
    const body: unknown = await req.json().catch(() => ({}));
    return NextResponse.json(await updateWritingSettings(session.user.id, body));
  } catch (error) {
    return gaiaErrorResponse(error) ?? apiError(error, "gaia/settings");
  }
}
