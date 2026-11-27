import { NextResponse } from "next/server";
import { requireUser } from "@/server/session";
import { apiError } from "@/server/api";
import { createInboxItem, gaiaErrorResponse, listInbox } from "@/server/gaia";

/** GET /api/gaia/inbox : ouvertes + traitées. */
export async function GET() {
  try {
    const session = await requireUser();
    const result = await listInbox(session.user.id);
    return NextResponse.json(result);
  } catch (error) {
    return gaiaErrorResponse(error) ?? apiError(error, "gaia/inbox");
  }
}

/** POST /api/gaia/inbox : capturer une idée (201). */
export async function POST(req: Request) {
  try {
    const session = await requireUser();
    const body = await req.json().catch(() => null);
    const result = await createInboxItem(session.user.id, body);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return gaiaErrorResponse(error) ?? apiError(error, "gaia/inbox");
  }
}
