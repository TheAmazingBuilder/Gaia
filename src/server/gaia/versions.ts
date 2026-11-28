import "server-only";

import {
  getVersionQuery,
  listVersionsQuery,
} from "@/modules/notes/services/versions";
import type {
  GaiaVersionDetail,
  GaiaVersionSummary,
} from "@/modules/notes/types";
import { notFound } from "@/shared/errors/gaia-error";

const VERSION_NOT_FOUND = () => notFound("VERSION_NOT_FOUND", "Version not found.");

export async function listVersions(
  userId: string,
  noteId: string,
): Promise<{ versions: GaiaVersionSummary[] }> {
  return listVersionsQuery(userId, noteId);
}

export async function getVersion(
  userId: string,
  noteId: string,
  versionId: string,
): Promise<{ version: GaiaVersionDetail }> {
  return getVersionQuery(userId, noteId, versionId, VERSION_NOT_FOUND);
}

import { restoreVersionCommand } from "@/modules/notes/services/versions";
import { createNoteSnapshotIfNeeded } from "@/modules/notes/services/snapshots";
import { cloneBlocksWithNewIds } from "@/modules/notes/services/block-copy";
import { loadFolders, loadTags } from "@/modules/notes/repositories/notes";
import { noteResponse } from "@/modules/notes/mappers";
import type { GaiaNoteResponse } from "@/modules/notes/types";

export async function restoreVersion(
  userId: string,
  noteId: string,
  versionId: string,
): Promise<GaiaNoteResponse> {
  return restoreVersionCommand(userId, noteId, versionId, {
    noteNotFound: () => notFound("NOTE_NOT_FOUND", "Note not found."),
    versionNotFound: VERSION_NOT_FOUND,
    maybeSnapshotVersion: createNoteSnapshotIfNeeded,
    cloneBlocksWithNewIds,
    noteResponse: async (ownerId, note) => {
      const [folders, tags] = await Promise.all([loadFolders(ownerId), loadTags(ownerId)]);
      return noteResponse(ownerId, note, folders, tags);
    },
  });
}
