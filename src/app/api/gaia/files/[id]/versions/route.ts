import { NextResponse } from "next/server";
import { requireUser } from "@/server/session";
import { apiError } from "@/server/api";
import {
  gaiaErrorResponse,
  replaceFile,
} from "@/server/gaia";
import { fileUploadError } from "@/lib/gaia/files";

/** POST /api/gaia/files/[id]/versions : remplacer le contenu (nouvelle version). */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireUser();
    const { id } = await params;
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "VALIDATION", message: "No file provided." }, { status: 422 });
    }
    const rejected = fileUploadError(file);
    if (rejected) {
      const message =
        rejected === "too-large"
          ? "File is too large (max 25 MB)."
          : rejected === "empty"
            ? "File is empty."
            : "This file type is not allowed.";
      return NextResponse.json({ error: "VALIDATION", message }, { status: 422 });
    }
    const result = await replaceFile(session.user.id, id, {
      name: file.name,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      buffer: Buffer.from(await file.arrayBuffer()),
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return gaiaErrorResponse(error) ?? apiError(error, "gaia/files/[id]/versions");
  }
}
