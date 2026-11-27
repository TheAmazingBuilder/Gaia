import { NextResponse } from "next/server";
import { requireUser } from "@/server/session";
import { apiError } from "@/server/api";
import {
  createFileRecord,
  gaiaErrorResponse,
  listFiles,
} from "@/server/gaia";
import { fileUploadError } from "@/lib/gaia/files";

/** GET /api/gaia/files : liste (q, folderId, kind, sort). */
export async function GET(req: Request) {
  try {
    const session = await requireUser();
    const url = new URL(req.url);
    const kind = url.searchParams.get("kind");
    const sort = url.searchParams.get("sort");
    const result = await listFiles(session.user.id, {
      q: url.searchParams.get("q") ?? undefined,
      folderId: url.searchParams.get("folderId") ?? undefined,
      kind: kind === "image" || kind === "pdf" || kind === "audio" || kind === "video" || kind === "document" || kind === "other" ? kind : undefined,
      sort: sort === "name" || sort === "size" ? sort : "newest",
    });
    return NextResponse.json(result);
  } catch (error) {
    return gaiaErrorResponse(error) ?? apiError(error, "gaia/files");
  }
}

/** POST /api/gaia/files : upload multipart (file + folderId optionnel). */
export async function POST(req: Request) {
  try {
    const session = await requireUser();
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
    const folderId = form.get("folderId");
    const result = await createFileRecord(session.user.id, {
      name: file.name,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      folderId: typeof folderId === "string" && folderId !== "" ? folderId : null,
      buffer: Buffer.from(await file.arrayBuffer()),
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return gaiaErrorResponse(error) ?? apiError(error, "gaia/files");
  }
}
