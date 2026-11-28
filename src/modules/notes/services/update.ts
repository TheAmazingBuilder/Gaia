import {
  findActiveNote,
  loadOtherActiveNotesForSync,
  loadTags,
  updateNoteLastViewed,
  updateNoteRecord,
  updateNoteBlocks,
} from "@/modules/notes/repositories/notes";
import { noteUpdateInputSchema } from "@/modules/notes/schemas";
import type { GaiaNoteResponse, GaiaNoteProperty } from "@/modules/notes/types";
import type { GaiaBlock, GaiaBlockInput } from "@/lib/gaia/content";
import { collectSyncedTexts, syncTextAcross } from "@/lib/gaia/tree";
import type { Note } from "@prisma/client";
import { parseOrThrow } from "@/shared/validation/parse-or-throw";

type UpdateNoteDependencies = {
  validationError: (message: string, issues?: { path: string; message: string }[]) => Error;
  noteNotFound: () => Error;
  normalizeBlocks: (input: GaiaBlockInput[]) => GaiaBlock[];
  parseStoredBlocks: (stored: string | null | undefined) => GaiaBlock[];
  assertSafeImageSources: (blocks: GaiaBlock[]) => void;
  normalizeProperties: (properties: GaiaNoteProperty[]) => GaiaNoteProperty[];
  maybeSnapshotVersion: (userId: string, note: Note) => Promise<void>;
  noteResponse: (userId: string, note: Note) => Promise<GaiaNoteResponse>;
};


/** Propagate edits to matching synced blocks in the user's other active notes. */
async function propagateSyncedBlocks(
  userId: string,
  sourceNoteId: string,
  synced: Map<string, string>,
  parseStoredBlocks: UpdateNoteDependencies["parseStoredBlocks"],
): Promise<void> {
  const others = await loadOtherActiveNotesForSync(userId, sourceNoteId);

  for (const other of others) {
    let next = parseStoredBlocks(other.blocks);
    let changed = false;
    for (const [syncId, text] of synced) {
      const updatedBlocks = syncTextAcross(next, syncId, text);
      if (updatedBlocks !== next) {
        changed = true;
        next = updatedBlocks;
      }
    }
    if (changed) {
      await updateNoteBlocks(other.id, JSON.stringify(next));
    }
  }
}

/**
 * Update a note while preserving the legacy API semantics, version snapshots,
 * tag filtering, block validation and cross-note synced-block propagation.
 */
export async function updateNoteCommand(
  userId: string,
  noteId: string,
  input: unknown,
  deps: UpdateNoteDependencies,
): Promise<GaiaNoteResponse> {
  const parsed = parseOrThrow(noteUpdateInputSchema, input, deps.validationError);
  const note = await findActiveNote(userId, noteId);
  if (!note) throw deps.noteNotFound();

  const hasMeaningfulChange =
    parsed.title !== undefined ||
    parsed.icon !== undefined ||
    parsed.folderId !== undefined ||
    parsed.tagIds !== undefined ||
    parsed.favorite !== undefined ||
    parsed.blocks !== undefined ||
    parsed.cover !== undefined ||
    parsed.wordGoal !== undefined ||
    parsed.properties !== undefined;

  if (!hasMeaningfulChange) {
    if (parsed.touchViewed === true) {
      const touched = await updateNoteLastViewed(note.id);
      return deps.noteResponse(userId, touched);
    }
    return deps.noteResponse(userId, note);
  }

  await deps.maybeSnapshotVersion(userId, note);

  const data: {
    title?: string;
    icon?: string | null;
    folderId?: string | null;
    tagIds?: string;
    favorite?: boolean;
    blocks?: string;
    cover?: string | null;
    wordGoal?: number | null;
    properties?: string;
    updatedAt: Date;
  } = { updatedAt: new Date() };

  if (parsed.title !== undefined) data.title = parsed.title.trim();
  if (parsed.icon !== undefined) data.icon = parsed.icon;
  if (parsed.folderId !== undefined) data.folderId = parsed.folderId;
  if (parsed.favorite !== undefined) data.favorite = parsed.favorite;
  if (parsed.cover !== undefined) data.cover = parsed.cover;
  if (parsed.wordGoal !== undefined) data.wordGoal = parsed.wordGoal;
  if (parsed.properties !== undefined) {
    data.properties = JSON.stringify(deps.normalizeProperties(parsed.properties));
  }
  if (parsed.tagIds !== undefined) {
    const known = await loadTags(userId);
    const knownIds = new Set(known.map((tag) => tag.id));
    data.tagIds = JSON.stringify(parsed.tagIds.filter((id) => knownIds.has(id)));
  }
  if (parsed.blocks !== undefined) {
    const blocks = deps.normalizeBlocks(parsed.blocks);
    deps.assertSafeImageSources(blocks);
    data.blocks = JSON.stringify(blocks);
  }

  const updated = await updateNoteRecord(note.id, data);

  if (parsed.blocks !== undefined) {
    const synced = collectSyncedTexts(deps.normalizeBlocks(parsed.blocks));
    if (synced.size > 0) {
      await propagateSyncedBlocks(userId, note.id, synced, deps.parseStoredBlocks);
    }
  }

  return deps.noteResponse(userId, updated);
}
