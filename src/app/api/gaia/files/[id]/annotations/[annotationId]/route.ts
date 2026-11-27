import { NextResponse } from "next/server";
import { requireUser } from "@/server/session";
import { apiError } from "@/server/api";
import {
  deleteFileAnnotation,
  gaiaErrorResponse,
} from "@/server/gaia";

/** DELETE /api/gaia/files/[id]/annotations/[annotationId]. */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; annotationId: string }> },
) {
  try {
    const session = await requireUser();
    const { id, annotationId } = await params;
    const result = await deleteFileAnnotation(session.user.id, id, annotationId);
    return NextResponse.json(result);
  } catch (error) {
    return gaiaErrorResponse(error) ?? apiError(error, "gaia/files/[id]/annotations/[annotationId]");
  }
}
