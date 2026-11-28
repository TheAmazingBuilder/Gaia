import {
  createTemplateCommand,
  instantiateTemplateCommand,
  listTemplatesQuery,
} from "@/modules/notes/services/templates";
import {
  normalizeBlocks,
  parseJsonBlocks,
} from "@/lib/gaia/content";
import type {
  GaiaNoteResponse,
  GaiaTemplateDTO,
} from "@/modules/notes/types";
import { assertSafeImageSources } from "@/modules/notes/content-validation";
import { createEmptyParagraphBlock, cloneBlocksWithNewIds } from "@/modules/notes/services/block-copy";
import { findActiveNote } from "@/modules/notes/repositories/notes";
import { notFound, validationError } from "@/shared/errors/gaia-error";

const NOTE_NOT_FOUND = () => notFound("NOTE_NOT_FOUND", "Note not found.");
const TEMPLATE_NOT_FOUND = () => notFound("TEMPLATE_NOT_FOUND", "Template not found.");

type CreateNoteAdapter = (userId: string, input: unknown) => Promise<GaiaNoteResponse>;

export async function listTemplates(
  userId: string,
): Promise<{ templates: GaiaTemplateDTO[] }> {
  return listTemplatesQuery(userId, parseJsonBlocks);
}

export async function createTemplate(
  userId: string,
  input: unknown,
): Promise<GaiaTemplateDTO> {
  return createTemplateCommand(userId, input, {
    validationError,
    noteNotFound: NOTE_NOT_FOUND,
    templateNotFound: TEMPLATE_NOT_FOUND,
    parseBlocks: normalizeBlocks,
    parseStoredBlocks: parseJsonBlocks,
    cloneBlocksWithNewIds,
    emptyParagraphBlock: createEmptyParagraphBlock,
    assertSafeImageSources: (blocks) => assertSafeImageSources(blocks, validationError),
    findActiveNote,
  });
}

/**
 * The note-creation adapter is injected to keep this module independent from
 * the root server facade and avoid a circular import.
 */
export async function instantiateTemplate(
  userId: string,
  input: unknown,
  createNote: CreateNoteAdapter,
): Promise<GaiaNoteResponse> {
  return instantiateTemplateCommand(userId, input, {
    validationError,
    noteNotFound: NOTE_NOT_FOUND,
    templateNotFound: TEMPLATE_NOT_FOUND,
    parseBlocks: normalizeBlocks,
    parseStoredBlocks: parseJsonBlocks,
    cloneBlocksWithNewIds,
    emptyParagraphBlock: createEmptyParagraphBlock,
    assertSafeImageSources: (blocks) => assertSafeImageSources(blocks, validationError),
    findActiveNote,
    createNote,
  });
}
