import {
  findActiveNote,
  findNoteVersion,
  loadNoteVersions,
  restoreNoteVersion,
} from "@/modules/notes/repositories/notes";
import { countWords, parseJsonBlocks } from "@/lib/gaia/content";
import { sortVersionsNewestFirst } from "@/lib/gaia/versioning";
import type {
  GaiaNoteResponse,
  GaiaVersionDetail,
  GaiaVersionSummary,
} from "@/modules/notes/types";
import type { Note } from "@prisma/client";

type VersionDependencies = {
  noteNotFound: () => Error;
  versionNotFound: () => Error;
  maybeSnapshotVersion: (userId: string, note: Note) => Promise<void>;
  cloneBlocksWithNewIds: (blocks: ReturnType<typeof parseJsonBlocks>) => ReturnType<typeof parseJsonBlocks>;
  noteResponse: (userId: string, note: Note) => Promise<GaiaNoteResponse>;
};

/** Read a user's note versions, newest first, preserving the legacy ordering. */
export async function listVersionsQuery(
  userId: string,
  noteId: string,
): Promise<{ versions: GaiaVersionSummary[] }> {
  const versions = await loadNoteVersions(userId, noteId);
  const sorted = sortVersionsNewestFirst(versions);
  return {
    versions: sorted.map((version) => ({
      id: version.id,
      title: version.title,
      savedAt: version.savedAt.toISOString(),
      wordCount: countWords(parseJsonBlocks(version.blocks)),
    })),
  };
}

/** Read one version only when all three ownership identifiers match. */
export async function getVersionQuery(
  userId: string,
  noteId: string,
  versionId: string,
  versionNotFound: () => Error,
): Promise<{ version: GaiaVersionDetail }> {
  const version = await findNoteVersion(userId, noteId, versionId);
  if (!version) throw versionNotFound();
  return {
    version: {
      id: version.id,
      title: version.title,
      savedAt: version.savedAt.toISOString(),
      blocks: parseJsonBlocks(version.blocks),
    },
  };
}

/** Restore a historical snapshot as a new edit, assigning fresh block IDs. */
export async function restoreVersionCommand(
  userId: string,
  noteId: string,
  versionId: string,
  deps: VersionDependencies,
): Promise<GaiaNoteResponse> {
  const note = await findActiveNote(userId, noteId);
  if (!note) throw deps.noteNotFound();

  const version = await findNoteVersion(userId, noteId, versionId);
  if (!version) throw deps.versionNotFound();

  await deps.maybeSnapshotVersion(userId, note);
  const updated = await restoreNoteVersion(note.id, {
    title: version.title,
    blocks: JSON.stringify(
      deps.cloneBlocksWithNewIds(parseJsonBlocks(version.blocks)),
    ),
    updatedAt: new Date(),
  });
  return deps.noteResponse(userId, updated);
}
