import { NextResponse } from "next/server";
import { requireUser } from "@/server/session";
import { apiError } from "@/server/api";
import {
  deleteFile,
  gaiaErrorResponse,
  getFile,
  updateFile,
} from "@/server/gaia";

/** GET /api/gaia/files/[id] : détail (versions, annotations, notes liées). */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireUser();
    const { id } = await params;
    const result = await getFile(session.user.id, id);
    return NextResponse.json(result);
  } catch (error) {
    return gaiaErrorResponse(error) ?? apiError(error, "gaia/files/[id]");
  }
}

/** PATCH /api/gaia/files/[id] : renommer / déplacer dans un dossier. */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireUser();
    const { id } = await params;
    const body = await req.json().catch(() => null);
    const result = await updateFile(session.user.id, id, body);
    return NextResponse.json(result);
  } catch (error) {
    return gaiaErrorResponse(error) ?? apiError(error, "gaia/files/[id]");
  }
}

/** DELETE /api/gaia/files/[id] : base + toutes les versions dans Storage. */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireUser();
    const { id } = await params;
    const result = await deleteFile(session.user.id, id);
    return NextResponse.json(result);
  } catch (error) {
    return gaiaErrorResponse(error) ?? apiError(error, "gaia/files/[id]");
  }
}
