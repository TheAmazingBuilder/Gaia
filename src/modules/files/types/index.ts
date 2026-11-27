import type { GaiaFileKind } from "@/lib/gaia/files";

export type GaiaFileDTO = {
  id: string;
  name: string;
  mimeType: string;
  kind: GaiaFileKind;
  size: number;
  folderId: string | null;
  folderName: string | null;
  /** true si un texte extrait (PDF / OCR) est stocké. */
  hasText: boolean;
  versionCount: number;
  noteCount: number;
  createdAt: string;
  updatedAt: string;
};

export type GaiaFileVersionDTO = {
  version: number;
  size: number;
  createdAt: string;
  current: boolean;
};

export type GaiaFileAnnotationDTO = {
  id: string;
  fileId: string;
  page: number;
  x: number;
  y: number;
  width: number | null;
  height: number | null;
  type: string;
  text: string;
  color: string;
  createdAt: string;
};

export type GaiaFileDetailDTO = GaiaFileDTO & {
  ocrText: string;
  versions: GaiaFileVersionDTO[];
  annotations: GaiaFileAnnotationDTO[];
  notes: Array<{ id: string; title: string; updatedAt: string }>;
};

export type GaiaStorageUsageDTO = {
  totalBytes: number;
  quotaBytes: number;
  fileCount: number;
  byKind: Array<{ kind: GaiaFileKind; count: number; bytes: number }>;
  largest: Array<{ id: string; name: string; size: number; mimeType: string }>;
};
