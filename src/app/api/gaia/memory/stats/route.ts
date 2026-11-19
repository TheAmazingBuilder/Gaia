import { NextResponse } from "next/server";
import { requireUser } from "@/server/session";
import { apiError } from "@/server/api";
import { gaiaErrorResponse, getMemoryStats } from "@/server/gaia";

/** GET /api/gaia/memory/stats : Memory Score, due count, counts by
 *  mastery, streak and the 26-week activity heatmap. */
export async function GET() {
  try {
    const session = await requireUser();
    const stats = await getMemoryStats(session.user.id);
    return NextResponse.json(stats);
  } catch (error) {
    return gaiaErrorResponse(error) ?? apiError(error, "gaia/memory/stats");
  }
}
