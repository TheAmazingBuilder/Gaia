import { NextResponse } from "next/server";
import { requireUser } from "@/server/session";
import { apiError } from "@/server/api";
import { gaiaErrorResponse, scheduleNote } from "@/server/gaia";

/** POST /api/gaia/notes/[id]/schedule { period: "today"|"week"|"month"|
 *  "later" } : reschedule a note into a time column (temporal Kanban
 *  drag & drop or "Move to…" menu). Rescheduling only — mastery, ease
 *  factor and review count are untouched. */
type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  try {
    const session = await requireUser();
    const { id } = await ctx.params;
    const body = await req.json().catch(() => null);
    const result = await scheduleNote(session.user.id, id, body);
    return NextResponse.json(result);
  } catch (error) {
    return gaiaErrorResponse(error) ?? apiError(error, "gaia/notes/[id]/schedule");
  }
}
