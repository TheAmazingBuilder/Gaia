import { db } from "@/shared/database/client";

/** File-owned reads used by the Notes attachment contract. */
export async function findOwnedFile(userId: string, fileId: string) {
  return db.gaiaFile.findFirst({ where: { userId, id: fileId }, select: { id: true } });
}

/** Load owned file records for a note's ordered attachment IDs. */
export async function loadFilesByIds(userId: string, fileIds: string[]) {
  if (fileIds.length === 0) return [];
  const rows = await db.gaiaFile.findMany({
    where: { userId, id: { in: fileIds } },
    include: { versions: { select: { id: true } } },
  });
  const byId = new Map(rows.map((row) => [row.id, row]));
  return fileIds.flatMap((id) => {
    const row = byId.get(id);
    return row ? [row] : [];
  });
}
