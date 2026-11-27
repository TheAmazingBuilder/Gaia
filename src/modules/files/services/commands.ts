import { db } from "@/lib/db";
import { fileToDTO } from "@/modules/files/mappers";
import type { GaiaFileDTO } from "@/modules/files/types";
import type { fileUpdateInputSchema } from "@/modules/files/schemas";
import type { z } from "zod";

type FileUpdateInput = z.infer<typeof fileUpdateInputSchema>;

type FileCommandErrors = {
  fileNotFound: () => Error;
  folderNotFound: () => Error;
};

/**
 * F01 — rename or move a file.
 * The caller owns input validation and supplies domain errors so the module
 * does not depend on the legacy Gaia service facade.
 */
export async function updateFileCommand(
  userId: string,
  fileId: string,
  input: FileUpdateInput,
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
      data: {
        ...(input.name ? { name: input.name } : {}),
        folderId,
      },
    }),
    folderId
      ? db.noteFolder.findFirst({ where: { userId, id: folderId }, select: { name: true } })
      : Promise.resolve(null),
    db.fileVersion.count({ where: { fileId: row.id } }),
    db.noteFile.count({ where: { fileId: row.id } }),
  ]);

  return {
    file: fileToDTO(updated, folder?.name ?? null, versionCount, noteCount),
  };
}
