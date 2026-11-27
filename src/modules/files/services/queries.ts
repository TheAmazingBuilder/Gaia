import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { fileKindOf, GAIA_STORAGE_QUOTA_BYTES, type GaiaFileKind } from "@/lib/gaia/files";
import { fileAnnotationToDTO, fileToDTO, fileVersionToDTO } from "@/modules/files/mappers";
import type { GaiaFileDTO, GaiaFileDetailDTO, GaiaStorageUsageDTO } from "@/modules/files/types";

export type ListFilesParams = {
  q?: string;
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

/** F03/F12 — liste des fichiers : recherche (nom + texte extrait), dossier, type, tri. */
export async function listFilesQuery(
  userId: string,
  params: ListFilesParams = {},
): Promise<{ files: GaiaFileDTO[]; total: number }> {
  const q = (params.q ?? "").trim();
  const where: Prisma.GaiaFileWhereInput = { userId };
  if (q !== "") {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { ocrText: { contains: q, mode: "insensitive" } },
    ];
  }
  if (params.folderId !== undefined && params.folderId !== "") {
    where.folderId = params.folderId;
  }
  if (params.kind) {
    const kindClause = kindWhere(params.kind);
    where.AND = [...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []), kindClause];
  }
  const orderBy: Prisma.GaiaFileOrderByWithRelationInput =
    params.sort === "name"
      ? { name: "asc" }
      : params.sort === "size"
        ? { size: "desc" }
        : { createdAt: "desc" };
  const [rows, folders, counts] = await Promise.all([
    db.gaiaFile.findMany({ where, orderBy, take: 500 }),
    db.noteFolder.findMany({ where: { userId }, orderBy: { name: "asc" } }),
    db.gaiaFile
      .findMany({ where, select: { id: true } })
      .then(async (found) => {
        const ids = found.map((f) => f.id);
        const [versions, links] = await Promise.all([
          db.fileVersion.groupBy({ by: ["fileId"], where: { fileId: { in: ids } }, _count: { _all: true } }),
          db.noteFile.groupBy({ by: ["fileId"], where: { fileId: { in: ids } }, _count: { _all: true } }),
        ]);
        return {
          versions: new Map(versions.map((v) => [v.fileId, v._count._all])),
          links: new Map(links.map((l) => [l.fileId, l._count._all])),
        };
      }),
  ]);
  const folderNames = new Map(folders.map((f) => [f.id, f.name]));
  return {
    files: rows.map((row) =>
      fileToDTO(
        row,
        row.folderId ? (folderNames.get(row.folderId) ?? null) : null,
        counts.versions.get(row.id) ?? 0,
        counts.links.get(row.id) ?? 0,
      ),
    ),
    total: rows.length,
  };
}

/** F03 — détail d'un fichier : métadonnées + versions + annotations + notes liées. */
export async function getFileQuery(
  userId: string,
  fileId: string,
  fileNotFound: () => Error,
): Promise<{ file: GaiaFileDetailDTO }> {
  const row = await db.gaiaFile.findFirst({
    where: { userId, id: fileId },
    include: {
      versions: { orderBy: { version: "desc" } },
      annotations: { orderBy: [{ page: "asc" }, { createdAt: "asc" }] },
      notes: { include: { note: { select: { id: true, title: true, updatedAt: true } } } },
    },
  });
  if (!row) throw fileNotFound();
  const folders = await db.noteFolder.findMany({ where: { userId }, orderBy: { name: "asc" } });
  const folderNames = new Map(folders.map((f) => [f.id, f.name]));
  const dto = fileToDTO(
    row,
    row.folderId ? (folderNames.get(row.folderId) ?? null) : null,
    row.versions.length,
    row.notes.length,
  );
  return {
    file: {
      ...dto,
      ocrText: row.ocrText,
      versions: row.versions.map((v) => fileVersionToDTO(v, row.storagePath)),
      annotations: row.annotations.map(fileAnnotationToDTO),
      notes: row.notes
        .map((l) => ({ id: l.note.id, title: l.note.title, updatedAt: l.note.updatedAt.toISOString() }))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    },
  };
}

/** F14 — espace de stockage : total, quota, répartition par type, plus gros fichiers. */
export async function getStorageUsageQuery(
  userId: string,
): Promise<{ usage: GaiaStorageUsageDTO }> {
  const rows = await db.gaiaFile.findMany({
    where: { userId },
    select: { id: true, name: true, mimeType: true, size: true },
  });
  const byKind = new Map<GaiaFileKind, { count: number; bytes: number }>();
  let totalBytes = 0;
  for (const row of rows) {
    const kind = fileKindOf(row.mimeType, row.name);
    const entry = byKind.get(kind) ?? { count: 0, bytes: 0 };
    entry.count += 1;
    entry.bytes += row.size;
    byKind.set(kind, entry);
    totalBytes += row.size;
  }
  const largest = [...rows]
    .sort((a, b) => b.size - a.size)
    .slice(0, 5)
    .map((r) => ({ id: r.id, name: r.name, size: r.size, mimeType: r.mimeType }));
  return {
    usage: {
      totalBytes,
      quotaBytes: GAIA_STORAGE_QUOTA_BYTES,
      fileCount: rows.length,
      byKind: [...byKind.entries()].map(([kind, v]) => ({ kind, count: v.count, bytes: v.bytes })),
      largest,
    },
  };
}
