import { NextResponse } from "next/server";
import { requireUser } from "@/server/session";
import { apiError } from "@/server/api";
import {
  gaiaErrorResponse,
  restoreFileVersion,
} from "@/server/gaia";

/** POST /api/gaia/files/[id]/restore : restaurer une version ({ version }). */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireUser();
    const { id } = await params;
    const body = await req.json().catch(() => null);
    const version = typeof body?.version === "number" ? body.version : NaN;
    if (!Number.isInteger(version) || version < 1) {
      return NextResponse.json({ error: "VALIDATION", message: "Version is required." }, { status: 422 });
    }
    const result = await restoreFileVersion(session.user.id, id, version);
    return NextResponse.json(result);
  } catch (error) {
    return gaiaErrorResponse(error) ?? apiError(error, "gaia/files/[id]/restore");
  }
}
