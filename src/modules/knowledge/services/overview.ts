import type { GaiaNoteRow, GaiaTemplateDTO } from "@/modules/notes/types";
import type { NoteListRow, NoteRowInput } from "@/modules/notes/types/list";
import type {
  NoteFolderMappingRecord,
  NoteTagMappingRecord,
} from "@/modules/notes/types/list";
import type {
  GaiaActivityWeek,
  GaiaFolderDTO,
  GaiaOverviewResponse,
  GaiaTagDTO,
} from "@/modules/knowledge/types";

type OverviewDependencies = {
  loadFolders: (userId: string) => Promise<NoteFolderMappingRecord[]>;
  loadTags: (userId: string) => Promise<NoteTagMappingRecord[]>;
  loadNotes: (userId: string) => Promise<NoteListRow[]>;
  loadBlocksFor: (noteIds: string[]) => Promise<Map<string, string>>;
  toRow: (note: NoteRowInput, folders: NoteFolderMappingRecord[], tags: NoteTagMappingRecord[]) => GaiaNoteRow;
  parseTagIds: (raw: string | null | undefined) => string[];
  listTemplates: (userId: string) => Promise<{ templates: GaiaTemplateDTO[] }>;
};

function startOfWeekMondayUTC(now: Date): Date {
  const day = now.getUTCDay();
  const mondayOffset = (day + 6) % 7;
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - mondayOffset),
  );
}

export async function getOverviewQuery(
  userId: string,
  deps: OverviewDependencies,
): Promise<GaiaOverviewResponse> {
  const [folders, tags, allNotes] = await Promise.all([
    deps.loadFolders(userId),
    deps.loadTags(userId),
    deps.loadNotes(userId),
  ]);
  const active = allNotes.filter((note) => note.deletedAt === null);
  const trashed = allNotes.filter((note) => note.deletedAt !== null);
  const weekAgo = Date.now() - 7 * 86_400_000;

  const recentEdited = [...active]
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, 6);
  const recentViewed = active
    .filter((note) => note.lastViewedAt !== null)
    .sort((a, b) => (b.lastViewedAt?.getTime() ?? 0) - (a.lastViewedAt?.getTime() ?? 0))
    .slice(0, 5);
  const favorites = active
    .filter((note) => note.favorite)
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, 5);

  const blocksById = await deps.loadBlocksFor([
    ...new Set([...recentEdited, ...recentViewed, ...favorites].map((note) => note.id)),
  ]);
  const toDisplayRow = (note: NoteListRow): GaiaNoteRow =>
    deps.toRow(
      { ...note, blocks: blocksById.get(note.id) ?? "[]" },
      folders,
      tags,
    );

  const foldersWithCounts: GaiaFolderDTO[] = folders
    .map((folder) => ({
      ...folder,
      noteCount: active.filter((note) => note.folderId === folder.id).length,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const tagsWithCounts: GaiaTagDTO[] = tags
    .map((tag) => ({
      ...tag,
      noteCount: active.filter((note) => deps.parseTagIds(note.tagIds).includes(tag.id)).length,
    }))
    .sort((a, b) => b.noteCount - a.noteCount || a.name.localeCompare(b.name));

  const monday = startOfWeekMondayUTC(new Date());
  const activity: GaiaActivityWeek[] = [];
  for (let offset = 7; offset >= 0; offset--) {
    const weekStartMs = monday.getTime() - offset * 7 * 86_400_000;
    const weekEndMs = weekStartMs + 7 * 86_400_000;
    const createdInWeek = active.filter(
      (note) => note.createdAt.getTime() >= weekStartMs && note.createdAt.getTime() < weekEndMs,
    );
    const createdIds = new Set(createdInWeek.map((note) => note.id));
    const editedInWeek = active.filter(
      (note) =>
        note.updatedAt.getTime() >= weekStartMs &&
        note.updatedAt.getTime() < weekEndMs &&
        !createdIds.has(note.id),
    );
    activity.push({
      weekStart: new Date(weekStartMs).toISOString().slice(0, 10),
      created: createdInWeek.length,
      edited: editedInWeek.length,
    });
  }

  const { templates } = await deps.listTemplates(userId);
  return {
    totals: {
      notes: active.length,
      createdThisWeek: active.filter((note) => note.createdAt.getTime() >= weekAgo).length,
      favorites: active.filter((note) => note.favorite).length,
      folders: folders.length,
      tags: tags.length,
      trashed: trashed.length,
    },
    recentEdited: recentEdited.map(toDisplayRow),
    recentViewed: recentViewed.map(toDisplayRow),
    favorites: favorites.map(toDisplayRow),
    folders: foldersWithCounts,
    topTags: tagsWithCounts.slice(0, 8),
    activity,
    templates: templates.slice(0, 4),
  };
}
