import { NextResponse } from "next/server";
import { requireUser } from "@/server/session";
import { apiError } from "@/server/api";
import {
  gaiaErrorResponse,
  getStorageUsage,
} from "@/server/gaia";

/** GET /api/gaia/files/storage : espace utilisé, quota, répartition, plus gros fichiers. */
export async function GET() {
  try {
    const session = await requireUser();
    const result = await getStorageUsage(session.user.id);
    return NextResponse.json(result);
  } catch (error) {
    return gaiaErrorResponse(error) ?? apiError(error, "gaia/files/storage");
  }
}
