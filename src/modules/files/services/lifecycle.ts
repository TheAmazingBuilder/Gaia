import { db } from "@/lib/db";
import { GAIA_MAX_FILE_BYTES } from "@/lib/gaia/files";
import { fileToDTO } from "@/modules/files/mappers";
import type { GaiaFileDTO } from "@/modules/files/types";
import {
  getStorageClient,
  isStorageConfigured,
  removeFromStorage,
  storagePathFor,
  uploadToStorage,
} from "@/server/storage";

type LifecycleErrors = {
  fileNotFound: () => Error;
  storageNotConfigured: () => Error;
  validationError: (message: string) => Error;
  storageUploadFailed: (message: string) => Error;
};

type RestoreErrors = {
  fileNotFound: () => Error;
  versionNotFound: () => Error;
  validationError: (message: string) => Error;
};

/**
 * F13 — stores a replacement as a new immutable Storage object and records
 * its metadata as the current version. The old binary remains available.
 */
export async function replaceFileCommand(
  userId: string,
  fileId: string,
  input: { name: string; mimeType: string; size: number; buffer: Buffer },
  errors: LifecycleErrors,
): Promise<{ file: GaiaFileDTO }> {
  if (!isStorageConfigured()) throw errors.storageNotConfigured();
  const client = getStorageClient();
  if (!client) throw errors.storageNotConfigured();

  const row = await db.gaiaFile.findFirst({
    where: { userId, id: fileId },
    include: { versions: { orderBy: { version: "desc" }, take: 1 } },
  });
  if (!row) throw errors.fileNotFound();
  if (input.size <= 0 || input.size > GAIA_MAX_FILE_BYTES) {
    throw errors.validationError("File size is out of bounds.");
  }

  const nextVersion = (row.versions[0]?.version ?? 0) + 1;
  const name = input.name.trim().slice(0, 200) || row.name;
  const path = storagePathFor(userId, row.id, nextVersion, name);
  const uploaded = await uploadToStorage(client, path, input.buffer, input.mimeType);
  if (!uploaded.ok) {
    throw errors.storageUploadFailed(uploaded.error ?? "Upload failed.");
  }

  const updated = await db.gaiaFile.update({
    where: { id: row.id },
    data: {
      name,
      mimeType: input.mimeType.slice(0, 200),
      size: input.size,
      storagePath: path,
      ocrText: "",
      versions: { create: { version: nextVersion, storagePath: path, size: input.size } },
    },
  }).catch(async (error: unknown) => {
    // Compensate only a failed database write; never remove a binary after
    // metadata has committed successfully.
    await removeFromStorage(client, [path]);
    throw error;
  });

  const [folder, noteCount] = await Promise.all([
    updated.folderId
      ? db.noteFolder.findFirst({
          where: { userId, id: updated.folderId },
          select: { name: true },
        })
      : Promise.resolve(null),
    db.noteFile.count({ where: { fileId: row.id } }),
  ]);
  return {
    file: fileToDTO(updated, folder?.name ?? null, nextVersion, noteCount),
  };
}

/**
 * F13 — restores an earlier binary by creating a new version that points to
 * the selected immutable Storage object; historical versions are retained.
 */
export async function restoreFileVersionCommand(
  userId: string,
  fileId: string,
  version: number,
  errors: RestoreErrors,
): Promise<{ file: GaiaFileDTO }> {
  const row = await db.gaiaFile.findFirst({
    where: { userId, id: fileId },
    include: { versions: { orderBy: { version: "desc" }, take: 1 } },
  });
  if (!row) throw errors.fileNotFound();

  const target = await db.fileVersion.findFirst({
    where: { fileId: row.id, version },
  });
  if (!target) throw errors.versionNotFound();
  if (target.storagePath === row.storagePath) {
    throw errors.validationError("This version is already the current one.");
  }

  const nextVersion = (row.versions[0]?.version ?? 0) + 1;
  const updated = await db.gaiaFile.update({
    where: { id: row.id },
    data: {
      storagePath: target.storagePath,
      size: target.size,
      ocrText: "",
      versions: {
        create: {
          version: nextVersion,
          storagePath: target.storagePath,
          size: target.size,
        },
      },
    },
  });
  const [folder, noteCount] = await Promise.all([
    updated.folderId
      ? db.noteFolder.findFirst({
          where: { userId, id: updated.folderId },
          select: { name: true },
        })
      : Promise.resolve(null),
    db.noteFile.count({ where: { fileId: row.id } }),
  ]);
  return {
    file: fileToDTO(updated, folder?.name ?? null, nextVersion, noteCount),
  };
}
