import { NextResponse } from "next/server";
import { requireUser } from "@/server/session";
import { apiError } from "@/server/api";
import { createCanvas, gaiaErrorResponse, listCanvases } from "@/server/gaia";

/** GET /api/gaia/canvases : tous les canvas. */
export async function GET() {
  try {
    const session = await requireUser();
    const result = await listCanvases(session.user.id);
    return NextResponse.json(result);
  } catch (error) {
    return gaiaErrorResponse(error) ?? apiError(error, "gaia/canvases");
  }
}

/** POST /api/gaia/canvases : créer un canvas (201). */
export async function POST(req: Request) {
  try {
    const session = await requireUser();
    const body = await req.json().catch(() => null);
    const result = await createCanvas(session.user.id, body);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return gaiaErrorResponse(error) ?? apiError(error, "gaia/canvases");
  }
}
