import type { Prisma } from "@prisma/client";
import { db } from "@/shared/database/client";
import type { GaiaFileKind } from "@/lib/gaia/files";

type FileListFilters = {
  q: string;
  folderId?: string;
  kind?: GaiaFileKind;
  sort?: "newest" | "name" | "size";
};

function kindWhere(kind: GaiaFileKind): Prisma.GaiaFileWhereInput {
  switch (kind) {
    case "image":
      return { mimeType: { startsWith: "image/" } };
    case "pdf":
      return { mimeType: "application/pdf" };
    case "audio":
      return { mimeType: { startsWith: "audio/" } };
    case "video":
      return { mimeType: { startsWith: "video/" } };
    case "document":
      return {
        OR: [
          { mimeType: { startsWith: "text/" } },
          { mimeType: { contains: "msword" } },
          { mimeType: { contains: "officedocument" } },
          { mimeType: { contains: "opendocument" } },
          { mimeType: "application/rtf" },
          { mimeType: "application/json" },
        ],
      };
    case "other":
      return {
        NOT: {
          OR: [
            { mimeType: { startsWith: "image/" } },
            { mimeType: "application/pdf" },
            { mimeType: { startsWith: "audio/" } },
            { mimeType: { startsWith: "video/" } },
            { mimeType: { startsWith: "text/" } },
          ],
        },
      };
  }
}

/** Load an owned file for binary download. */
export async function findOwnedFileForDownload(userId: string, fileId: string) {
  return db.gaiaFile.findFirst({ where: { userId, id: fileId } });
}

/** Load file rows and version counts for the list DTO. */
export async function loadFileListData(userId: string, filters: FileListFilters) {
  const where: Prisma.GaiaFileWhereInput = { userId };
  if (filters.q !== "") {
    where.OR = [
      { name: { contains: filters.q, mode: "insensitive" } },
      { ocrText: { contains: filters.q, mode: "insensitive" } },
    ];
  }
  if (filters.folderId !== undefined && filters.folderId !== "") {
    where.folderId = filters.folderId;
  }
  if (filters.kind) {
    const kindClause = kindWhere(filters.kind);
    where.AND = [...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []), kindClause];
  }
  const orderBy: Prisma.GaiaFileOrderByWithRelationInput =
    filters.sort === "name"
      ? { name: "asc" }
      : filters.sort === "size"
        ? { size: "desc" }
        : { createdAt: "desc" };

  const [rows, found] = await Promise.all([
    db.gaiaFile.findMany({ where, orderBy, take: 500 }),
    db.gaiaFile.findMany({ where, select: { id: true } }),
  ]);
  const ids = found.map((file) => file.id);
  const versions = ids.length
    ? await db.fileVersion.groupBy({
        by: ["fileId"],
        where: { fileId: { in: ids } },
        _count: { _all: true },
      })
    : [];

  return {
    rows,
    versionCounts: new Map(versions.map((item) => [item.fileId, item._count._all])),
  };
}

/** Load the complete owned file record without crossing into Notes persistence. */
export async function findOwnedFileDetail(userId: string, fileId: string) {
  return db.gaiaFile.findFirst({
    where: { userId, id: fileId },
    include: {
      versions: { orderBy: { version: "desc" } },
      annotations: { orderBy: [{ page: "asc" }, { createdAt: "asc" }] },
    },
  });
}

/** Load owned file records for an ordered set of IDs. */
export async function loadOwnedFilesByIds(userId: string, fileIds: string[]) {
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

export async function loadUserFileStorageRows(userId: string) {
  return db.gaiaFile.findMany({
    where: { userId },
    select: { id: true, name: true, mimeType: true, size: true },
  });
}
