import type { FileAnnotation, FileVersion, GaiaFile } from "@prisma/client";
import { fileKindOf } from "@/lib/gaia/files";
import type {
  GaiaFileAnnotationDTO,
  GaiaFileDTO,
  GaiaFileVersionDTO,
} from "@/modules/files/types";

export function fileToDTO(
  row: GaiaFile,
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

export function fileVersionToDTO(row: FileVersion, currentPath: string): GaiaFileVersionDTO {
  return {
    version: row.version,
    size: row.size,
    createdAt: row.createdAt.toISOString(),
    current: row.storagePath === currentPath,
  };
}

export function fileAnnotationToDTO(row: FileAnnotation): GaiaFileAnnotationDTO {
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
