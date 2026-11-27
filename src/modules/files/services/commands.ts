import { db } from "@/lib/db";
import { fileAnnotationToDTO, fileToDTO } from "@/modules/files/mappers";
import type {
  fileAnnotationInputSchema,
  fileTextInputSchema,
} from "@/modules/files/schemas";
import type {
  GaiaFileAnnotationDTO,
  GaiaFileDTO,
} from "@/modules/files/types";
import type { z } from "zod";

type FileTextInput = z.infer<typeof fileTextInputSchema>;
type FileAnnotationInput = z.infer<typeof fileAnnotationInputSchema>;

type FileCommandErrors = {
  fileNotFound: () => Error;
  folderNotFound: () => Error;
  annotationNotFound: () => Error;
};

/** F01 — rename or move a file. */
export async function updateFileCommand(
  userId: string,
  fileId: string,
  input: { name?: string; folderId?: string | null },
  errors: FileCommandErrors,
): Promise<{ file: GaiaFileDTO }> {
  const row = await db.gaiaFile.findFirst({ where: { userId, id: fileId } });
  if (!row) throw errors.fileNotFound();

  let folderId = row.folderId;
  if (input.folderId !== undefined) {
    if (input.folderId === null) {
      folderId = null;
    } else {
      const folder = await db.noteFolder.findFirst({
        where: { userId, id: input.folderId },
        select: { id: true },
      });
      if (!folder) throw errors.folderNotFound();
      folderId = folder.id;
    }
  }

  const [updated, folder, versionCount, noteCount] = await Promise.all([
    db.gaiaFile.update({
      where: { id: row.id },
      data: { ...(input.name ? { name: input.name } : {}), folderId },
    }),
    folderId
      ? db.noteFolder.findFirst({ where: { userId, id: folderId }, select: { name: true } })
      : Promise.resolve(null),
    db.fileVersion.count({ where: { fileId: row.id } }),
    db.noteFile.count({ where: { fileId: row.id } }),
  ]);

  return { file: fileToDTO(updated, folder?.name ?? null, versionCount, noteCount) };
}

/** F04 — persist extracted PDF/OCR text without changing file metadata. */
export async function saveFileTextCommand(
  userId: string,
  fileId: string,
  input: FileTextInput,
  fileNotFound: () => Error,
): Promise<{ file: GaiaFileDTO }> {
  const row = await db.gaiaFile.findFirst({ where: { userId, id: fileId } });
  if (!row) throw fileNotFound();

  const [updated, folder, versionCount, noteCount] = await Promise.all([
    db.gaiaFile.update({ where: { id: row.id }, data: { ocrText: input.text } }),
    row.folderId
      ? db.noteFolder.findFirst({ where: { userId, id: row.folderId }, select: { name: true } })
      : Promise.resolve(null),
    db.fileVersion.count({ where: { fileId: row.id } }),
    db.noteFile.count({ where: { fileId: row.id } }),
  ]);
  return { file: fileToDTO(updated, folder?.name ?? null, versionCount, noteCount) };
}

/** F05 — create an annotation on an owned file. */
export async function createFileAnnotationCommand(
  userId: string,
  fileId: string,
  input: FileAnnotationInput,
  fileNotFound: () => Error,
): Promise<{ annotation: GaiaFileAnnotationDTO }> {
  const file = await db.gaiaFile.findFirst({ where: { userId, id: fileId }, select: { id: true } });
  if (!file) throw fileNotFound();
  const created = await db.fileAnnotation.create({
    data: {
      fileId: file.id,
      userId,
      page: input.page,
      x: input.x,
      y: input.y,
      width: input.width ?? null,
      height: input.height ?? null,
      type: input.type,
      text: input.text,
      color: input.color,
    },
  });
  return { annotation: fileAnnotationToDTO(created) };
}

/** F05 — delete an annotation only when it belongs to this user and file. */
export async function deleteFileAnnotationCommand(
  userId: string,
  fileId: string,
  annotationId: string,
  annotationNotFound: () => Error,
): Promise<{ ok: true }> {
  const annotation = await db.fileAnnotation.findFirst({
    where: { userId, id: annotationId, fileId },
    select: { id: true },
  });
  if (!annotation) throw annotationNotFound();
  await db.fileAnnotation.delete({ where: { id: annotation.id } });
  return { ok: true };
}
