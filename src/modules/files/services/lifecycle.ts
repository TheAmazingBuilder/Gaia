import {
  createReplacementFileVersion,
  createRestoredFileVersion,
  deleteFileAndVersions,
  findOwnedFileForLifecycle,
  findFileVersion,
} from "@/modules/files/repositories/lifecycle";
import {
  countNotesAttachedToFile,
  findFolderForFile,
} from "@/modules/notes/contracts/files";
import { GAIA_MAX_FILE_BYTES } from "@/lib/gaia/files";
import { fileToDTO } from "@/modules/files/mappers";
import type { GaiaFileDTO } from "@/modules/files/types";
import type { SupabaseClient } from "@supabase/supabase-js";

type LifecycleStorage = {
  isConfigured: () => boolean;
  getClient: () => SupabaseClient | null;
  remove: (client: SupabaseClient, paths: string[]) => Promise<void>;
  pathFor: (userId: string, fileId: string, version: number, name: string) => string;
  upload: (client: SupabaseClient, path: string, buffer: Buffer, mimeType: string) => Promise<{ ok: boolean; error?: string }>;
};

type LifecycleErrors = {
  fileNotFound: () => Error;
  storageNotConfigured: () => Error;
  validationError: (message: string) => Error;
  storageUploadFailed: (message: string) => Error;
  storageCleanupFailed: (message: string) => Error;
  versionConflict: () => Error;
};

type RestoreErrors = {
  fileNotFound: () => Error;
  versionNotFound: () => Error;
  validationError: (message: string) => Error;
  versionConflict: () => Error;
};

export async function replaceFileCommand(
  userId: string,
  fileId: string,
  input: { name: string; mimeType: string; size: number; buffer: Buffer },
  errors: LifecycleErrors,
  storage: LifecycleStorage,
): Promise<{ file: GaiaFileDTO }> {
  if (!storage.isConfigured()) throw errors.storageNotConfigured();
  const client = storage.getClient();
  if (!client) throw errors.storageNotConfigured();

  const row = await findOwnedFileForLifecycle(userId, fileId);
  if (!row) throw errors.fileNotFound();
  if (input.size <= 0 || input.size > GAIA_MAX_FILE_BYTES) throw errors.validationError("File size is out of bounds.");

  const name = input.name.trim().slice(0, 200) || row.name;
  const nextVersion = (row.versions[0]?.version ?? 0) + 1;
  const path = storage.pathFor(userId, row.id, nextVersion, name);
  const uploaded = await storage.upload(client, path, input.buffer, input.mimeType);
  if (!uploaded.ok) throw errors.storageUploadFailed(uploaded.error ?? "Upload failed.");

  let result;
  try {
    result = await createReplacementFileVersion({
      userId, fileId: row.id, currentStoragePath: row.storagePath, name,
      mimeType: input.mimeType.slice(0, 200), size: input.size, storagePath: path, version: nextVersion,
    });
    if (!result) throw errors.versionConflict();
  } catch (error) {
    try {
      await storage.remove(client, [path]);
    } catch (cleanupError) {
      const message = cleanupError instanceof Error ? cleanupError.message : "Storage cleanup failed.";
      throw errors.storageCleanupFailed(message);
    }
    throw error;
  }

  const updated = result.file;
  const [folder, noteCount] = await Promise.all([
    updated.folderId ? findFolderForFile(userId, updated.folderId) : Promise.resolve(null),
    countNotesAttachedToFile(row.id),
  ]);
  return { file: fileToDTO(updated, folder?.name ?? null, result.nextVersion, noteCount) };
}

export async function restoreFileVersionCommand(
  userId: string,
  fileId: string,
  version: number,
  errors: RestoreErrors,
): Promise<{ file: GaiaFileDTO }> {
  const row = await findOwnedFileForLifecycle(userId, fileId);
  if (!row) throw errors.fileNotFound();
  const target = await findFileVersion(row.id, version);
  if (!target) throw errors.versionNotFound();
  if (target.storagePath === row.storagePath) throw errors.validationError("This version is already the current one.");

  const result = await createRestoredFileVersion({
    userId, fileId: row.id, currentStoragePath: row.storagePath,
    targetStoragePath: target.storagePath, targetSize: target.size,
    version: (row.versions[0]?.version ?? 0) + 1,
  });
  if (!result) throw errors.versionConflict();

  const updated = result.file;
  const [folder, noteCount] = await Promise.all([
    updated.folderId ? findFolderForFile(userId, updated.folderId) : Promise.resolve(null),
    countNotesAttachedToFile(row.id),
  ]);
  return { file: fileToDTO(updated, folder?.name ?? null, result.nextVersion, noteCount) };
}

type DeleteErrors = {
  fileNotFound: () => Error;
  storageNotConfigured: () => Error;
  storageRemovalFailed: (message: string) => Error;
};

/** Delete binaries before metadata; retain the row if Storage removal fails. */
export async function deleteFileCommand(
  userId: string,
  fileId: string,
  errors: DeleteErrors,
  storage: Pick<LifecycleStorage, "isConfigured" | "getClient" | "remove">,
): Promise<{ ok: true }> {
  if (!storage.isConfigured()) throw errors.storageNotConfigured();
  const client = storage.getClient();
  if (!client) throw errors.storageNotConfigured();

  const deleted = await deleteFileAndVersions(userId, fileId, async (paths) => {
    try {
      await storage.remove(client, paths);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Storage removal failed.";
      throw errors.storageRemovalFailed(message);
    }
  });
  if (!deleted) throw errors.fileNotFound();
  return { ok: true };
}
