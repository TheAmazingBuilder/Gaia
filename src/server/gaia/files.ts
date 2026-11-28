import "server-only";

/**
 * Adaptateurs serveur publics du module Files.
 * Préserve les signatures historiques consommées par les routes API.
 */
import type {
  GaiaFileAnnotationDTO,
  GaiaFileDTO,
  GaiaFileDetailDTO,
  GaiaFileVersionDTO,
  GaiaStorageUsageDTO,
} from "@/modules/files/types";
import { fileAnnotationInputSchema, fileTextInputSchema, fileUpdateInputSchema } from "@/modules/files/schemas";
import {
  createFileAnnotationCommand,
  createFileCommand,
  deleteFileAnnotationCommand,
  saveFileTextCommand,
  updateFileCommand,
} from "@/modules/files/services/commands";
import {
  attachFileToNoteCommand,
  detachFileFromNoteCommand,
  listFileNotesQuery,
  listNoteFilesQuery,
} from "@/modules/files/services/associations";
import {
  deleteFileCommand,
  replaceFileCommand,
  restoreFileVersionCommand,
} from "@/modules/files/services/lifecycle";
import {
  getFileQuery,
  downloadFileQuery,
  getStorageUsageQuery,
  listFilesQuery,
  type ListFilesParams,
} from "@/modules/files/services/queries";
import { GaiaError, conflictError, notFound, validationError } from "@/shared/errors/gaia-error";
import { parseOrThrow } from "@/shared/validation/parse-or-throw";
import {
  downloadFromStorage,
  getStorageClient,
  isStorageConfigured,
  removeFromStorage,
  storagePathFor,
  uploadToStorage,
} from "@/server/storage";

export type {
  GaiaFileAnnotationDTO,
  GaiaFileDTO,
  GaiaFileDetailDTO,
  GaiaFileVersionDTO,
  GaiaStorageUsageDTO,
  ListFilesParams,
};

const FILE_NOT_FOUND = () => notFound("FILE_NOT_FOUND", "File not found.");
const FOLDER_NOT_FOUND = () => notFound("FOLDER_NOT_FOUND", "Folder not found.");
const STORAGE_NOT_CONFIGURED = () =>
  new GaiaError(
    "ServiceUnavailable",
    "STORAGE_NOT_CONFIGURED",
    503,
    "File storage is not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to the environment.",
  );

// ── Module 3 — File & Document Management (F01–F15) ─────────────────────
// Les binaires vivent dans Supabase Storage (bucket privé `gaia-files`) ;
// ici ne vivent que les métadonnées, toujours scopées par userId.

/** F03/F12 — liste des fichiers : lecture déléguée au module Files. */
export async function listFiles(
  userId: string,
  params: ListFilesParams = {},
): Promise<{ files: GaiaFileDTO[]; total: number }> {
  return listFilesQuery(userId, params);
}

/** F03 — détail d'un fichier : lecture déléguée au module Files. */
export async function getFile(
  userId: string,
  fileId: string,
): Promise<{ file: GaiaFileDetailDTO }> {
  return getFileQuery(userId, fileId, FILE_NOT_FOUND);
}

/** F01/F02 — upload : binaire → Storage, métadonnées + version 1 en base. */
export async function createFileRecord(
  userId: string,
  input: { name: string; mimeType: string; size: number; folderId?: string | null; buffer: Buffer },
): Promise<{ file: GaiaFileDTO }> {
  return createFileCommand(userId, input, {
    folderNotFound: FOLDER_NOT_FOUND,
    validationError,
    storageNotConfigured: STORAGE_NOT_CONFIGURED,
    storageUploadFailed: (message) =>
      new GaiaError("ServiceUnavailable", "STORAGE_UPLOAD_FAILED", 503, message),
  }, {
    isConfigured: isStorageConfigured,
    getClient: getStorageClient,
    pathFor: storagePathFor,
    upload: uploadToStorage,
    remove: removeFromStorage,
  });
}

/** F01 — renommer / déplacer un fichier (métadonnées uniquement). */
export async function updateFile(
  userId: string,
  fileId: string,
  input: unknown,
): Promise<{ file: GaiaFileDTO }> {
  const parsed = parseOrThrow(fileUpdateInputSchema, input);
  return updateFileCommand(userId, fileId, parsed, {
    fileNotFound: FILE_NOT_FOUND,
    folderNotFound: FOLDER_NOT_FOUND,
  });
}
/** F13 — remplacer le contenu : nouvelle version, l'ancienne est conservée. */
export async function replaceFile(
  userId: string,
  fileId: string,
  input: { name: string; mimeType: string; size: number; buffer: Buffer },
): Promise<{ file: GaiaFileDTO }> {
  return replaceFileCommand(userId, fileId, input, {
    fileNotFound: FILE_NOT_FOUND,
    storageNotConfigured: STORAGE_NOT_CONFIGURED,
    validationError,
    storageUploadFailed: (message) =>
      new GaiaError("ServiceUnavailable", "STORAGE_UPLOAD_FAILED", 503, message),
    storageCleanupFailed: (message) =>
      new GaiaError("ServiceUnavailable", "STORAGE_CLEANUP_FAILED", 503, message),
    versionConflict: () =>
      conflictError("FILE_VERSION_CONFLICT", "The file changed during this operation. Refresh and retry."),
  }, {
    isConfigured: isStorageConfigured,
    getClient: getStorageClient,
    remove: removeFromStorage,
    pathFor: storagePathFor,
    upload: uploadToStorage,
  });
}
/** F13 — restaurer une ancienne version : crée une version qui pointe vers l'ancien binaire. */
export async function restoreFileVersion(
  userId: string,
  fileId: string,
  version: number,
): Promise<{ file: GaiaFileDTO }> {
  return restoreFileVersionCommand(userId, fileId, version, {
    fileNotFound: FILE_NOT_FOUND,
    versionNotFound: () => notFound("FILE_VERSION_NOT_FOUND", "File version not found."),
    validationError,
    versionConflict: () =>
      conflictError("FILE_VERSION_CONFLICT", "The file changed during this operation. Refresh and retry."),
  });
}

/** F01 — supprimer un fichier : base + toutes les versions dans Storage. */
export async function deleteFile(userId: string, fileId: string): Promise<{ ok: true }> {
  return deleteFileCommand(userId, fileId, {
    fileNotFound: FILE_NOT_FOUND,
    storageNotConfigured: STORAGE_NOT_CONFIGURED,
    storageRemovalFailed: (message) =>
      new GaiaError("ServiceUnavailable", "STORAGE_DELETE_FAILED", 503, message),
  }, {
    isConfigured: isStorageConfigured,
    getClient: getStorageClient,
    remove: removeFromStorage,
  });
}

/** F01 — télécharger le binaire d'un fichier (version courante). */
export async function downloadFile(
  userId: string,
  fileId: string,
): Promise<{ blob: Blob; contentType: string; name: string; size: number }> {
  return downloadFileQuery(userId, fileId, {
    fileNotFound: FILE_NOT_FOUND,
    storageNotConfigured: STORAGE_NOT_CONFIGURED,
    storageDownloadFailed: (message) =>
      new GaiaError("ServiceUnavailable", "STORAGE_DOWNLOAD_FAILED", 503, message),
  }, {
    isConfigured: isStorageConfigured,
    getClient: getStorageClient,
    download: downloadFromStorage,
  });
}

/** F10/F12 — enregistrer le texte extrait (calque texte PDF ou OCR). */
export async function saveFileText(
  userId: string,
  fileId: string,
  input: unknown,
): Promise<{ file: GaiaFileDTO }> {
  const parsed = parseOrThrow(fileTextInputSchema, input);
  return saveFileTextCommand(userId, fileId, parsed, FILE_NOT_FOUND);
}

/** F05 — ajouter une annotation à un document. */
export async function createFileAnnotation(
  userId: string,
  fileId: string,
  input: unknown,
): Promise<{ annotation: GaiaFileAnnotationDTO }> {
  const parsed = parseOrThrow(fileAnnotationInputSchema, input);
  return createFileAnnotationCommand(userId, fileId, parsed, FILE_NOT_FOUND);
}

/** F05 — supprimer une annotation. */
export async function deleteFileAnnotation(
  userId: string,
  fileId: string,
  annotationId: string,
): Promise<{ ok: true }> {
  return deleteFileAnnotationCommand(
    userId,
    fileId,
    annotationId,
    () => notFound("ANNOTATION_NOT_FOUND", "Annotation not found."),
  );
}

/** F06/F15 — attacher un fichier à une note. */
export async function attachFileToNote(
  userId: string,
  noteId: string,
  fileId: string,
): Promise<{ ok: true }> {
  return attachFileToNoteCommand(userId, noteId, fileId, {
    noteNotFound: NOTE_NOT_FOUND,
    fileNotFound: FILE_NOT_FOUND,
  });
}

/** F06 — détacher un fichier d'une note (le fichier lui-même est conservé). */
export async function detachFileFromNote(
  userId: string,
  noteId: string,
  fileId: string,
): Promise<{ ok: true }> {
  return detachFileFromNoteCommand(userId, noteId, fileId, NOTE_NOT_FOUND);
}

/** F06 — fichiers attachés à une note. */
export async function listNoteFiles(
  userId: string,
  noteId: string,
): Promise<{ files: GaiaFileDTO[] }> {
  return listNoteFilesQuery(userId, noteId, NOTE_NOT_FOUND);
}

/** F15 — notes qui référencent un fichier. */
export async function listFileNotes(
  userId: string,
  fileId: string,
): Promise<{ notes: Array<{ id: string; title: string; updatedAt: string }> }> {
  return listFileNotesQuery(userId, fileId, FILE_NOT_FOUND);
}

/** F14 — espace de stockage : lecture déléguée au module Files. */
export async function getStorageUsage(userId: string): Promise<{ usage: GaiaStorageUsageDTO }> {
  return getStorageUsageQuery(userId);
}
