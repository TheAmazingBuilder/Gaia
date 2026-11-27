import { NextResponse } from "next/server";
import { requireUser } from "@/server/session";
import { apiError } from "@/server/api";
import { gaiaErrorResponse, getOrCreateWeeklyNote } from "@/server/gaia";

/** POST /api/gaia/notes/weekly : ouvre (ou crée) la note de la semaine. */
export async function POST() {
  try {
    const session = await requireUser();
    const result = await getOrCreateWeeklyNote(session.user.id);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return gaiaErrorResponse(error) ?? apiError(error, "gaia/notes/weekly");
  }
}
