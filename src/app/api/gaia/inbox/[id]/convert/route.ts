import { NextResponse } from "next/server";
import { requireUser } from "@/server/session";
import { apiError } from "@/server/api";
import { convertInboxItem, gaiaErrorResponse } from "@/server/gaia";

/** POST /api/gaia/inbox/[id]/convert : idée → note (201). */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireUser();
    const { id } = await params;
    const result = await convertInboxItem(session.user.id, id);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return gaiaErrorResponse(error) ?? apiError(error, "gaia/inbox/[id]/convert");
  }
}
