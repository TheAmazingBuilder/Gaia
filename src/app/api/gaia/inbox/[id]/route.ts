import { NextResponse } from "next/server";
import { requireUser } from "@/server/session";
import { apiError } from "@/server/api";
import {
  deleteInboxItem,
  gaiaErrorResponse,
  toggleInboxItem,
} from "@/server/gaia";

/** PATCH /api/gaia/inbox/[id] : { done: boolean }. */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireUser();
    const { id } = await params;
    const body = await req.json().catch(() => null);
    const done = body !== null && typeof body === "object" && (body as { done?: unknown }).done === true;
    const result = await toggleInboxItem(session.user.id, id, done);
    return NextResponse.json(result);
  } catch (error) {
    return gaiaErrorResponse(error) ?? apiError(error, "gaia/inbox/[id]");
  }
}

/** DELETE /api/gaia/inbox/[id]. */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireUser();
    const { id } = await params;
    const result = await deleteInboxItem(session.user.id, id);
    return NextResponse.json(result);
  } catch (error) {
    return gaiaErrorResponse(error) ?? apiError(error, "gaia/inbox/[id]");
  }
}
