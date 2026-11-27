import { NextResponse } from "next/server";
import { requireUser } from "@/server/session";
import { apiError } from "@/server/api";
import {
  gaiaErrorResponse,
  saveFileText,
} from "@/server/gaia";

/** POST /api/gaia/files/[id]/text : enregistrer le texte extrait (PDF / OCR). */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireUser();
    const { id } = await params;
    const body = await req.json().catch(() => null);
    const result = await saveFileText(session.user.id, id, body);
    return NextResponse.json(result);
  } catch (error) {
    return gaiaErrorResponse(error) ?? apiError(error, "gaia/files/[id]/text");
  }
}
