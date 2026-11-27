import { NextResponse } from "next/server";
import { requireUser } from "@/server/session";
import { apiError } from "@/server/api";
import { deleteNoteRelation, gaiaErrorResponse } from "@/server/gaia";

/** DELETE /api/gaia/notes/[id]/relations/[relationId]. */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; relationId: string }> },
) {
  try {
    const session = await requireUser();
    const { id, relationId } = await params;
    const result = await deleteNoteRelation(session.user.id, id, relationId);
    return NextResponse.json(result);
  } catch (error) {
    return gaiaErrorResponse(error) ?? apiError(error, "gaia/notes/[id]/relations/[relationId]");
  }
}
