import {
  findOwnedFileDetail,
  findOwnedFileForDownload,
  loadFileListData,
  loadUserFileFolders,
  loadUserFileStorageRows,
} from "@/modules/files/repositories/queries";
import { fileKindOf, GAIA_STORAGE_QUOTA_BYTES, type GaiaFileKind } from "@/lib/gaia/files";
import { fileAnnotationToDTO, fileToDTO, fileVersionToDTO } from "@/modules/files/mappers";
import type { GaiaFileDTO, GaiaFileDetailDTO, GaiaStorageUsageDTO } from "@/modules/files/types";
import type { SupabaseClient } from "@supabase/supabase-js";

type DownloadStorage = {
  isConfigured: () => boolean;
  getClient: () => SupabaseClient | null;
  download: (
    client: SupabaseClient,
    path: string,
  ) => Promise<{ ok: true; blob: Blob; contentType: string } | { ok: false; error: string }>;
};

type DownloadErrors = {
  fileNotFound: () => Error;
  storageNotConfigured: () => Error;
  storageDownloadFailed: (message: string) => Error;
};

/** F01 — download the current binary after checking file ownership. */
export async function downloadFileQuery(
  userId: string,
  fileId: string,
  errors: DownloadErrors,
  storage: DownloadStorage,
): Promise<{ blob: Blob; contentType: string; name: string; size: number }> {
  if (!storage.isConfigured()) throw errors.storageNotConfigured();
  const client = storage.getClient();
  if (!client) throw errors.storageNotConfigured();

  const row = await findOwnedFileForDownload(userId, fileId);
  if (!row) throw errors.fileNotFound();

  const result = await storage.download(client, row.storagePath);
  if (!result.ok) throw errors.storageDownloadFailed(result.error);

  return {
    blob: result.blob,
    contentType: result.contentType,
    name: row.name,
    size: row.size,
  };
}


export type ListFilesParams = {
  q?: string;
  folderId?: string;
  kind?: GaiaFileKind;
  sort?: "newest" | "name" | "size";
};

/** F03/F12 — liste des fichiers : recherche (nom + texte extrait), dossier, type, tri. */
export async function listFilesQuery(
  userId: string,
  params: ListFilesParams = {},
): Promise<{ files: GaiaFileDTO[]; total: number }> {
  const q = (params.q ?? "").trim();
  const { rows, folders, counts } = await loadFileListData(userId, {
    q,
    folderId: params.folderId,
    kind: params.kind,
    sort: params.sort,
  });
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
  const row = await findOwnedFileDetail(userId, fileId);
  if (!row) throw fileNotFound();
  const folders = await loadUserFileFolders(userId);
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
  const rows = await loadUserFileStorageRows(userId);
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
