import { NextResponse } from "next/server";
import { requireUser } from "@/server/session";
import { apiError } from "@/server/api";
import { gaiaErrorResponse, getTodayWords } from "@/server/gaia";

/** GET /api/gaia/writing/today : mots écrits aujourd'hui (Module 1, E12). */
export async function GET() {
  try {
    const session = await requireUser();
    return NextResponse.json(await getTodayWords(session.user.id));
  } catch (error) {
    return gaiaErrorResponse(error) ?? apiError(error, "gaia/writing/today");
  }
}
