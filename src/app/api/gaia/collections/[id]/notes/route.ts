import { NextResponse } from "next/server";
import { requireUser } from "@/server/session";
import { apiError } from "@/server/api";
import { gaiaErrorResponse, listCollectionNotes } from "@/server/gaia";

/** GET /api/gaia/collections/[id]/notes?page=N : notes de la collection. */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireUser();
    const { id } = await params;
    const page = Number(new URL(req.url).searchParams.get("page") ?? "1") || 1;
    const result = await listCollectionNotes(session.user.id, id, page);
    return NextResponse.json(result);
  } catch (error) {
    return gaiaErrorResponse(error) ?? apiError(error, "gaia/collections/[id]/notes");
  }
}
