import { fileKindOf } from "@/lib/gaia/files";
import type {
  GaiaFileAnnotationDTO,
  GaiaFileDTO,
  GaiaFileVersionDTO,
} from "@/modules/files/types";

type FileRowForDTO = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  folderId: string | null;
  ocrText: string;
  createdAt: Date;
  updatedAt: Date;
};

type FileVersionRowForDTO = {
  version: number;
  size: number;
  createdAt: Date;
  storagePath: string;
};

type FileAnnotationRowForDTO = {
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
  createdAt: Date;
};

export function fileToDTO(
  row: FileRowForDTO,
  folderName: string | null,
  versionCount: number,
  noteCount: number,
): GaiaFileDTO {
  return {
    id: row.id,
    name: row.name,
    mimeType: row.mimeType,
    kind: fileKindOf(row.mimeType, row.name),
    size: row.size,
    folderId: row.folderId,
    folderName,
    hasText: row.ocrText !== "",
    versionCount,
    noteCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function fileVersionToDTO(
  row: FileVersionRowForDTO,
  currentPath: string,
): GaiaFileVersionDTO {
  return {
    version: row.version,
    size: row.size,
    createdAt: row.createdAt.toISOString(),
    current: row.storagePath === currentPath,
  };
}

export function fileAnnotationToDTO(
  row: FileAnnotationRowForDTO,
): GaiaFileAnnotationDTO {
  return {
    id: row.id,
    fileId: row.fileId,
    page: row.page,
    x: row.x,
    y: row.y,
    width: row.width,
    height: row.height,
    type: row.type,
    text: row.text,
    color: row.color,
    createdAt: row.createdAt.toISOString(),
  };
}
