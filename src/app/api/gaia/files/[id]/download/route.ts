import { NextResponse } from "next/server";
import { requireUser } from "@/server/session";
import { apiError } from "@/server/api";
import {
  downloadFile,
  gaiaErrorResponse,
} from "@/server/gaia";

/** GET /api/gaia/files/[id]/download : binaire en proxy (?download=1 = pièce jointe). */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireUser();
    const { id } = await params;
    const asAttachment = new URL(req.url).searchParams.get("download") === "1";
    const result = await downloadFile(session.user.id, id);
    const disposition = `${asAttachment ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(result.name)}`;
    return new NextResponse(result.blob, {
      headers: {
        "Content-Type": result.contentType,
        "Content-Disposition": disposition,
        "Content-Length": String(result.size),
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (error) {
    return gaiaErrorResponse(error) ?? apiError(error, "gaia/files/[id]/download");
  }
}
