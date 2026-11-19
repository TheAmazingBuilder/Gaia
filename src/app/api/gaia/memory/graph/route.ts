import { NextResponse } from "next/server";
import { requireUser } from "@/server/session";
import { apiError } from "@/server/api";
import { gaiaErrorResponse, getMemoryGraph } from "@/server/gaia";

/** GET /api/gaia/memory/graph : knowledge graph — nodes are the user's
 *  active notes, edges are note→note references (solid) and shared tags
 *  (dashed, capped — see getMemoryGraph). */
export async function GET() {
  try {
    const session = await requireUser();
    const graph = await getMemoryGraph(session.user.id);
    return NextResponse.json(graph);
  } catch (error) {
    return gaiaErrorResponse(error) ?? apiError(error, "gaia/memory/graph");
  }
}
