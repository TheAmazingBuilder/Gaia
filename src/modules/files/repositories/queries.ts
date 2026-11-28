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

/** Load file rows, folders and per-file counts for the list DTO. */
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

  const [rows, folders, found] = await Promise.all([
    db.gaiaFile.findMany({ where, orderBy, take: 500 }),
    db.noteFolder.findMany({ where: { userId }, orderBy: { name: "asc" } }),
    db.gaiaFile.findMany({ where, select: { id: true } }),
  ]);
  const ids = found.map((file) => file.id);
  const [versions, links] = ids.length
    ? await Promise.all([
        db.fileVersion.groupBy({ by: ["fileId"], where: { fileId: { in: ids } }, _count: { _all: true } }),
        db.noteFile.groupBy({ by: ["fileId"], where: { fileId: { in: ids } }, _count: { _all: true } }),
      ])
    : [[], []];

  return {
    rows,
    folders,
    counts: {
      versions: new Map(versions.map((item) => [item.fileId, item._count._all])),
      links: new Map(links.map((item) => [item.fileId, item._count._all])),
    },
  };
}

/** Load the complete owned file record for its detail DTO. */
export async function findOwnedFileDetail(userId: string, fileId: string) {
  return db.gaiaFile.findFirst({
    where: { userId, id: fileId },
    include: {
      versions: { orderBy: { version: "desc" } },
      annotations: { orderBy: [{ page: "asc" }, { createdAt: "asc" }] },
      notes: { include: { note: { select: { id: true, title: true, updatedAt: true } } } },
    },
  });
}

export async function loadUserFileFolders(userId: string) {
  return db.noteFolder.findMany({ where: { userId }, orderBy: { name: "asc" } });
}

export async function loadUserFileStorageRows(userId: string) {
  return db.gaiaFile.findMany({
    where: { userId },
    select: { id: true, name: true, mimeType: true, size: true },
  });
}
