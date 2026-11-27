import { NextResponse } from "next/server";
import { requireUser } from "@/server/session";
import { apiError } from "@/server/api";
import {
  createFileAnnotation,
  gaiaErrorResponse,
} from "@/server/gaia";

/** POST /api/gaia/files/[id]/annotations : ajouter une annotation. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireUser();
    const { id } = await params;
    const body = await req.json().catch(() => null);
    const result = await createFileAnnotation(session.user.id, id, body);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return gaiaErrorResponse(error) ?? apiError(error, "gaia/files/[id]/annotations");
  }
}
