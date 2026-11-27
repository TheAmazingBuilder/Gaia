import { NextResponse } from "next/server";
import { requireUser } from "@/server/session";
import { apiError } from "@/server/api";
import { gaiaErrorResponse, getKnowledgeTimeline } from "@/server/gaia";

/** GET /api/gaia/knowledge/timeline : croissance des connaissances par mois. */
export async function GET() {
  try {
    const session = await requireUser();
    const result = await getKnowledgeTimeline(session.user.id);
    return NextResponse.json(result);
  } catch (error) {
    return gaiaErrorResponse(error) ?? apiError(error, "gaia/knowledge/timeline");
  }
}
