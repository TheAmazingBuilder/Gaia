import { NextResponse } from "next/server";
import { requireUser } from "@/server/session";
import { apiError } from "@/server/api";
import {
  detachFileFromNote,
  gaiaErrorResponse,
} from "@/server/gaia";

/** DELETE /api/gaia/notes/[id]/files/[fileId] : détacher (le fichier est conservé). */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; fileId: string }> },
) {
  try {
    const session = await requireUser();
    const { id, fileId } = await params;
    const result = await detachFileFromNote(session.user.id, id, fileId);
    return NextResponse.json(result);
  } catch (error) {
    return gaiaErrorResponse(error) ?? apiError(error, "gaia/notes/[id]/files/[fileId]");
  }
}
