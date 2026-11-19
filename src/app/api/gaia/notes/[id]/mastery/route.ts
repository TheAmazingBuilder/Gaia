import { NextResponse } from "next/server";
import { requireUser } from "@/server/session";
import { apiError } from "@/server/api";
import { gaiaErrorResponse, moveNoteToMastery } from "@/server/gaia";

/** POST /api/gaia/notes/[id]/mastery { mastery: "forgotten"|"fragile"|
 *  "medium"|"mastered" } : move a note to a mastery column (Kanban drag &
 *  drop or "Move to…" menu). Reclassification, not a review. */
type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  try {
    const session = await requireUser();
    const { id } = await ctx.params;
    const body = await req.json().catch(() => null);
    const result = await moveNoteToMastery(session.user.id, id, body);
    return NextResponse.json(result);
  } catch (error) {
    return gaiaErrorResponse(error) ?? apiError(error, "gaia/notes/[id]/mastery");
  }
}
