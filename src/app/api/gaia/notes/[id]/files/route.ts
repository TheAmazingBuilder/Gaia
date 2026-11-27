import { NextResponse } from "next/server";
import { requireUser } from "@/server/session";
import { apiError } from "@/server/api";
import {
  attachFileToNote,
  gaiaErrorResponse,
  listNoteFiles,
} from "@/server/gaia";

/** GET /api/gaia/notes/[id]/files : fichiers attachés à la note. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireUser();
    const { id } = await params;
    const result = await listNoteFiles(session.user.id, id);
    return NextResponse.json(result);
  } catch (error) {
    return gaiaErrorResponse(error) ?? apiError(error, "gaia/notes/[id]/files");
  }
}

/** POST /api/gaia/notes/[id]/files : attacher un fichier ({ fileId }). */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireUser();
    const { id } = await params;
    const body = await req.json().catch(() => null);
    const fileId = typeof body?.fileId === "string" ? body.fileId : "";
    if (fileId === "") {
      return NextResponse.json({ error: "VALIDATION", message: "fileId is required." }, { status: 422 });
    }
    const result = await attachFileToNote(session.user.id, id, fileId);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return gaiaErrorResponse(error) ?? apiError(error, "gaia/notes/[id]/files");
  }
}
