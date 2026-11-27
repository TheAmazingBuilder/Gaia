import { NextResponse } from "next/server";
import { requireUser } from "@/server/session";
import { apiError } from "@/server/api";
import {
  createCollection,
  gaiaErrorResponse,
  listCollections,
} from "@/server/gaia";

/** GET /api/gaia/collections : collections + nombre de notes. */
export async function GET() {
  try {
    const session = await requireUser();
    const result = await listCollections(session.user.id);
    return NextResponse.json(result);
  } catch (error) {
    return gaiaErrorResponse(error) ?? apiError(error, "gaia/collections");
  }
}

/** POST /api/gaia/collections : créer une collection (201). */
export async function POST(req: Request) {
  try {
    const session = await requireUser();
    const body = await req.json().catch(() => null);
    const result = await createCollection(session.user.id, body);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return gaiaErrorResponse(error) ?? apiError(error, "gaia/collections");
  }
}
