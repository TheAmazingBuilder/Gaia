import "server-only";

import { getOverviewQuery } from "@/modules/knowledge/services/overview";
import { loadOverviewNotesQuery, loadBlocksFor } from "@/modules/notes/services/list";
import { loadFolders, loadTags } from "@/modules/notes/repositories/notes";
import { toRow } from "@/modules/notes/mappers";
import { parseJsonBlocks, parseJsonStringArray } from "@/lib/gaia/content";
import { listTemplatesQuery } from "@/modules/notes/services/templates";

type OverviewDependencies = Parameters<typeof getOverviewQuery>[1];

const overviewDependencies: OverviewDependencies = {
  loadFolders,
  loadTags,
  loadNotes: loadOverviewNotesQuery,
  loadBlocksFor,
  toRow,
  parseTagIds: parseJsonStringArray,
  listTemplates: (userId) => listTemplatesQuery(userId, parseJsonBlocks),
};

export function getOverview(userId: string) {
  return getOverviewQuery(userId, overviewDependencies);
}
