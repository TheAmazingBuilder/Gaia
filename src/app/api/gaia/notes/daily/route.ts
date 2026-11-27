import { NextResponse } from "next/server";
import { requireUser } from "@/server/session";
import { apiError } from "@/server/api";
import { gaiaErrorResponse, getOrCreateDailyNote } from "@/server/gaia";

/** POST /api/gaia/notes/daily : ouvre (ou crée) la note du jour. */
export async function POST() {
  try {
    const session = await requireUser();
    const result = await getOrCreateDailyNote(session.user.id);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return gaiaErrorResponse(error) ?? apiError(error, "gaia/notes/daily");
  }
}
