import "server-only";

import {
  createFolderCommand,
  deleteFolderCommand,
  listFoldersQuery,
  updateFolderCommand,
} from "@/modules/notes/services/folders";
import {
  createTagCommand,
  deleteTagCommand,
  listTagsQuery,
  updateTagCommand,
} from "@/modules/notes/services/tags";
import { folderInputSchema, tagInputSchema } from "@/modules/knowledge/schemas";
import type { GaiaFolderDTO, GaiaTagDTO } from "@/modules/knowledge/types";
import { parseJsonStringArray } from "@/lib/gaia/content";
import { isDescendantOf } from "@/lib/gaia/knowledge";
import {
  conflictError,
  notFound,
  validationError,
} from "@/shared/errors/gaia-error";
import { parseOrThrow } from "@/shared/validation/parse-or-throw";

const FOLDER_NOT_FOUND = () => notFound("FOLDER_NOT_FOUND", "Folder not found.");

export async function listFolders(userId: string): Promise<{ folders: GaiaFolderDTO[] }> {
  return listFoldersQuery(userId);
}

export async function createFolder(userId: string, input: unknown): Promise<GaiaFolderDTO> {
  const parsed = parseOrThrow(folderInputSchema, input);
  return createFolderCommand(userId, parsed, {
    folderNotFound: FOLDER_NOT_FOUND,
    validationError,
    conflictError,
  });
}

export async function updateFolder(
  userId: string,
  folderId: string,
  input: unknown,
): Promise<GaiaFolderDTO> {
  const parsed = parseOrThrow(folderInputSchema, input);
  return updateFolderCommand(userId, folderId, parsed, {
    folderNotFound: FOLDER_NOT_FOUND,
    validationError,
    conflictError,
    isDescendantOf,
  });
}

export async function deleteFolder(userId: string, folderId: string): Promise<{ ok: true }> {
  return deleteFolderCommand(userId, folderId, FOLDER_NOT_FOUND);
}

export async function listTags(userId: string): Promise<{ tags: GaiaTagDTO[] }> {
  return listTagsQuery(userId, parseJsonStringArray);
}

export async function createTag(userId: string, input: unknown): Promise<GaiaTagDTO> {
  const parsed = parseOrThrow(tagInputSchema, input);
  return createTagCommand(userId, parsed, {
    notFound: (code, message) => notFound(code, message),
    validationError,
    conflictError,
    parseJsonStringArray,
  });
}

export async function updateTag(
  userId: string,
  tagId: string,
  input: unknown,
): Promise<GaiaTagDTO> {
  const parsed = parseOrThrow(tagInputSchema, input);
  return updateTagCommand(userId, tagId, parsed, {
    notFound: (code, message) => notFound(code, message),
    validationError,
    conflictError,
    isDescendantOf,
    parseJsonStringArray,
  });
}

export async function deleteTag(userId: string, tagId: string): Promise<{ ok: true }> {
  return deleteTagCommand(userId, tagId, {
    notFound: (code, message) => notFound(code, message),
    parseJsonStringArray,
  });
}
