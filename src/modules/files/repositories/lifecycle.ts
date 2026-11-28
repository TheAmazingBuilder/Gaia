import { db } from "@/shared/database/client";

/** Persistence operations for immutable file-version lifecycle commands. */
export async function findOwnedFileForLifecycle(userId: string, fileId: string) {
  return db.gaiaFile.findFirst({
    where: { userId, id: fileId },
    include: { versions: { orderBy: { version: "desc" }, take: 1 } },
  });
}

export async function createReplacementFileVersion(input: {
  userId: string;
  fileId: string;
  currentStoragePath: string;
  name: string;
  mimeType: string;
  size: number;
  storagePath: string;
  version: number;
}) {
  return db.$transaction(async (tx) => {
    // Compare-and-swap: only one concurrent operation can advance this file
    // from the version that the caller originally read.
    const claimed = await tx.gaiaFile.updateMany({
      where: {
        id: input.fileId,
        userId: input.userId,
        storagePath: input.currentStoragePath,
      },
      data: {
        name: input.name,
        mimeType: input.mimeType,
        size: input.size,
        storagePath: input.storagePath,
        ocrText: "",
      },
    });
    if (claimed.count !== 1) return null;

    await tx.fileVersion.create({
      data: {
        fileId: input.fileId,
        version: input.version,
        storagePath: input.storagePath,
        size: input.size,
      },
    });
    const file = await tx.gaiaFile.findFirstOrThrow({
      where: { id: input.fileId, userId: input.userId },
    });
    return { file, nextVersion: input.version };
  });
}

export async function createRestoredFileVersion(input: {
  userId: string;
  fileId: string;
  currentStoragePath: string;
  targetStoragePath: string;
  targetSize: number;
  version: number;
}) {
  return db.$transaction(async (tx) => {
    const claimed = await tx.gaiaFile.updateMany({
      where: {
        id: input.fileId,
        userId: input.userId,
        storagePath: input.currentStoragePath,
      },
      data: {
        storagePath: input.targetStoragePath,
        size: input.targetSize,
        ocrText: "",
      },
    });
    if (claimed.count !== 1) return null;

    await tx.fileVersion.create({
      data: {
        fileId: input.fileId,
        version: input.version,
        storagePath: input.targetStoragePath,
        size: input.targetSize,
      },
    });
    const file = await tx.gaiaFile.findFirstOrThrow({
      where: { id: input.fileId, userId: input.userId },
    });
    return { file, nextVersion: input.version };
  });
}

export async function findOwnedFileVersion(userId: string, fileId: string, version: number) {
  return db.fileVersion.findFirst({
    where: { fileId, version },
  });
}

export async function loadFileLifecycleMetadata(userId: string, fileId: string, folderId: string | null) {
  const [folder, noteCount] = await Promise.all([
    folderId
      ? db.noteFolder.findFirst({
          where: { userId, id: folderId },
          select: { name: true },
        })
      : Promise.resolve(null),
    db.noteFile.count({ where: { fileId } }),
  ]);
  return { folder, noteCount };
}

/**
 * Lock the parent row while removing all immutable version binaries and
 * deleting metadata. The callback intentionally runs inside the transaction
 * to preserve the existing replace/restore/delete serialization contract.
 */
export async function deleteFileAndVersions(
  userId: string,
  fileId: string,
  removeStorage: (paths: string[]) => Promise<void>,
) {
  return db.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM gaia_files
      WHERE id = ${fileId} AND user_id = ${userId}
      FOR UPDATE
    `;
    if (locked.length === 0) return false;

    const row = await tx.gaiaFile.findFirst({
      where: { userId, id: fileId },
      include: { versions: { select: { storagePath: true } } },
    });
    if (!row) return false;

    const paths = [...new Set([row.storagePath, ...row.versions.map((version) => version.storagePath)])];
    await removeStorage(paths);
    await tx.gaiaFile.delete({ where: { id: row.id } });
    return true;
  }, {
    maxWait: 5_000,
    // Keep the row lock bounded while allowing larger version histories.
    timeout: 30_000,
  });
}
