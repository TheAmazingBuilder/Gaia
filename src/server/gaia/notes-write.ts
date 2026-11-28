import { createNoteCommand, duplicateNoteCommand } from "@/modules/notes/services/commands";
import { updateNoteCommand } from "@/modules/notes/services/update";
import { findTemplateQuery } from "@/modules/notes/services/templates";
import { createNoteSnapshotIfNeeded } from "@/modules/notes/services/snapshots";
import { normalizeProperties } from "@/modules/notes/normalization";
import { findActiveNote, loadFolders, loadTags } from "@/modules/notes/repositories/notes";
import { assertSafeImageSources } from "@/modules/notes/content-validation";
import { createEmptyParagraphBlock, cloneBlocksWithNewIds } from "@/modules/notes/services/block-copy";
import { normalizeBlocks, parseJsonBlocks } from "@/lib/gaia/content";
import { noteResponse } from "@/modules/notes/mappers";
import { notFound, validationError } from "@/shared/errors/gaia-error";
import type { GaiaNoteResponse } from "@/modules/notes/types";

const NOTE_NOT_FOUND = () => notFound("NOTE_NOT_FOUND", "Note not found.");
const FOLDER_NOT_FOUND = () => notFound("FOLDER_NOT_FOUND", "Folder not found.");

const noteResponseForOwner = async (ownerId: string, note: Parameters<typeof noteResponse>[1]) => {
  const [folders, tags] = await Promise.all([loadFolders(ownerId), loadTags(ownerId)]);
  return noteResponse(ownerId, note, folders, tags);
};

export async function createNote(
  userId: string,
  input: unknown,
): Promise<GaiaNoteResponse> {
  return createNoteCommand(userId, input, {
    validationError,
    noteNotFound: NOTE_NOT_FOUND,
    folderNotFound: FOLDER_NOT_FOUND,
    parseBlocks: normalizeBlocks,
    parseStoredBlocks: parseJsonBlocks,
    cloneBlocksWithNewIds,
    emptyParagraphBlock: createEmptyParagraphBlock,
    assertSafeImageSources: (blocks) => assertSafeImageSources(blocks, validationError),
    normalizeProperties,
    findTemplate: async (ownerId, templateId) =>
      findTemplateQuery(ownerId, templateId, parseJsonBlocks),
    findActiveNote,
    noteResponse: noteResponseForOwner,
  });
}

export async function updateNote(
  userId: string,
  noteId: string,
  input: unknown,
): Promise<GaiaNoteResponse> {
  return updateNoteCommand(userId, noteId, input, {
    validationError,
    noteNotFound: NOTE_NOT_FOUND,
    normalizeBlocks,
    parseStoredBlocks: parseJsonBlocks,
    assertSafeImageSources: (blocks) => assertSafeImageSources(blocks, validationError),
    normalizeProperties,
    maybeSnapshotVersion: createNoteSnapshotIfNeeded,
    noteResponse: noteResponseForOwner,
  });
}

export async function duplicateNote(
  userId: string,
  noteId: string,
  input: unknown,
): Promise<GaiaNoteResponse> {
  return duplicateNoteCommand(userId, noteId, input, {
    validationError,
    noteNotFound: NOTE_NOT_FOUND,
    folderNotFound: FOLDER_NOT_FOUND,
    parseBlocks: normalizeBlocks,
    parseStoredBlocks: parseJsonBlocks,
    cloneBlocksWithNewIds,
    emptyParagraphBlock: createEmptyParagraphBlock,
    assertSafeImageSources: (blocks) => assertSafeImageSources(blocks, validationError),
    normalizeProperties,
    findTemplate: async (ownerId, templateId) =>
      findTemplateQuery(ownerId, templateId, parseJsonBlocks),
    findActiveNote,
    noteResponse: noteResponseForOwner,
  });
}
