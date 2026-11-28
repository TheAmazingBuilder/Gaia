import {
  countFileVersions, createFileAnnotationRecord, createFileWithFirstVersion,
  deleteFileAnnotationRecord, findOwnedFileAnnotation, findOwnedFileRecord,
  saveFileOcrText, updateFileRecord,
} from "@/modules/files/repositories/commands";
import {
  countNotesAttachedToFile,
  findFolderForFile,
} from "@/modules/notes/contracts/files";
import { GAIA_MAX_FILE_BYTES } from "@/lib/gaia/files";
import { fileAnnotationToDTO, fileToDTO } from "@/modules/files/mappers";
import type { fileAnnotationInputSchema, fileTextInputSchema } from "@/modules/files/schemas";
import type { GaiaFileAnnotationDTO, GaiaFileDTO } from "@/modules/files/types";
import type { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

type FileTextInput = z.infer<typeof fileTextInputSchema>;
type FileAnnotationInput = z.infer<typeof fileAnnotationInputSchema>;

type CreateFileInput = {
  name: string;
  mimeType: string;
  size: number;
  folderId?: string | null;
  buffer: Buffer;
};

type CreateFileErrors = {
  folderNotFound: () => Error;
  validationError: (message: string) => Error;
  storageNotConfigured: () => Error;
  storageUploadFailed: (message: string) => Error;
};

type CreateFileStorage = {
  isConfigured: () => boolean;
  getClient: () => SupabaseClient | null;
  pathFor: (userId: string, fileId: string, version: number, name: string) => string;
  upload: (client: SupabaseClient, path: string, buffer: Buffer, mimeType: string) => Promise<{ ok: boolean; error?: string }>;
  remove: (client: SupabaseClient, paths: string[]) => Promise<void>;
};

/** F01/F02 — upload a binary, then atomically create its metadata and first version. */
export async function createFileCommand(
  userId: string,
  input: CreateFileInput,
  errors: CreateFileErrors,
  storage: CreateFileStorage,
): Promise<{ file: GaiaFileDTO }> {
  if (!storage.isConfigured()) throw errors.storageNotConfigured();
  const client = storage.getClient();
  if (!client) throw errors.storageNotConfigured();

  const name = input.name.trim().slice(0, 200);
  if (name === "") throw errors.validationError("File name is required.");
  if (input.size <= 0 || input.size > GAIA_MAX_FILE_BYTES) throw errors.validationError("File size is out of bounds.");

  let folderId: string | null = null;
  if (input.folderId) {
    const folder = await findFolderForFile(userId, input.folderId);
    if (!folder) throw errors.folderNotFound();
    folderId = folder.id;
  }

  const id = `cm${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const path = storage.pathFor(userId, id, 1, name);
  const uploaded = await storage.upload(client, path, input.buffer, input.mimeType);
  if (!uploaded.ok) throw errors.storageUploadFailed(uploaded.error ?? "Upload failed.");

  try {
    const row = await createFileWithFirstVersion({ id, userId, name, mimeType: input.mimeType.slice(0, 200), size: input.size, storagePath: path, folderId });
    const folder = folderId ? await findFolderForFile(userId, folderId) : null;
    return { file: fileToDTO(row, folder?.name ?? null, 1, 0) };
  } catch (error) {
    await storage.remove(client, [path]);
    throw error;
  }
}

type FileCommandErrors = { fileNotFound: () => Error; folderNotFound: () => Error };

/** F01 — rename or move a file. */
export async function updateFileCommand(
  userId: string,
  fileId: string,
  input: { name?: string; folderId?: string | null },
  errors: FileCommandErrors,
): Promise<{ file: GaiaFileDTO }> {
  const row = await findOwnedFileRecord(userId, fileId);
  if (!row) throw errors.fileNotFound();

  let folderId = row.folderId;
  if (input.folderId !== undefined) {
    if (input.folderId === null) folderId = null;
    else {
      const folder = await findFolderForFile(userId, input.folderId);
      if (!folder) throw errors.folderNotFound();
      folderId = folder.id;
    }
  }

  const [updated, folder, versionCount, noteCount] = await Promise.all([
    updateFileRecord(row.id, { ...(input.name ? { name: input.name } : {}), folderId }),
    folderId ? findFolderForFile(userId, folderId) : Promise.resolve(null),
    countFileVersions(row.id),
    countNotesAttachedToFile(row.id),
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
  const row = await findOwnedFileRecord(userId, fileId);
  if (!row) throw fileNotFound();

  const [updated, folder, versionCount, noteCount] = await Promise.all([
    saveFileOcrText(row.id, input.text),
    row.folderId ? findFolderForFile(userId, row.folderId) : Promise.resolve(null),
    countFileVersions(row.id),
    countNotesAttachedToFile(row.id),
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
  const file = await findOwnedFileRecord(userId, fileId);
  if (!file) throw fileNotFound();
  const created = await createFileAnnotationRecord({ fileId: file.id, userId, page: input.page, x: input.x, y: input.y, width: input.width ?? null, height: input.height ?? null, type: input.type, text: input.text, color: input.color });
  return { annotation: fileAnnotationToDTO(created) };
}

/** F05 — delete an annotation only when it belongs to this user and file. */
export async function deleteFileAnnotationCommand(
  userId: string,
  fileId: string,
  annotationId: string,
  annotationNotFound: () => Error,
): Promise<{ ok: true }> {
  const annotation = await findOwnedFileAnnotation(userId, fileId, annotationId);
  if (!annotation) throw annotationNotFound();
  await deleteFileAnnotationRecord(annotation.id);
  return { ok: true };
}
