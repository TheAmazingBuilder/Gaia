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
