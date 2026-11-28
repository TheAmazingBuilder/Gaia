import { db } from "@/shared/database/client";

type NewFileRecord = {
  id: string;
  userId: string;
  name: string;
  mimeType: string;
  size: number;
  storagePath: string;
  folderId: string | null;
};

/** Persistence operations for file commands. */
export async function createFileWithFirstVersion(data: NewFileRecord) {
  return db.gaiaFile.create({
    data: {
      ...data,
      versions: { create: { version: 1, storagePath: data.storagePath, size: data.size } },
    },
  });
}

export async function findOwnedFileRecord(userId: string, fileId: string) {
  return db.gaiaFile.findFirst({ where: { userId, id: fileId } });
}

export async function updateFileRecord(
  fileId: string,
  data: { name?: string; folderId: string | null },
) {
  return db.gaiaFile.update({ where: { id: fileId }, data });
}

export async function saveFileOcrText(fileId: string, text: string) {
  return db.gaiaFile.update({ where: { id: fileId }, data: { ocrText: text } });
}

export async function countFileVersions(fileId: string) {
  return db.fileVersion.count({ where: { fileId } });
}

export async function countFileNoteAssociations(fileId: string) {
  return db.noteFile.count({ where: { fileId } });
}

export async function createFileAnnotationRecord(data: {
  fileId: string;
  userId: string;
  page: number;
  x: number;
  y: number;
  width: number | null;
  height: number | null;
  type: "note" | "highlight";
  text: string;
  color: string;
}) {
  return db.fileAnnotation.create({ data });
}

export async function findOwnedFileAnnotation(
  userId: string,
  fileId: string,
  annotationId: string,
) {
  return db.fileAnnotation.findFirst({
    where: { userId, id: annotationId, fileId },
    select: { id: true },
  });
}

export async function deleteFileAnnotationRecord(annotationId: string) {
  return db.fileAnnotation.delete({ where: { id: annotationId } });
}
