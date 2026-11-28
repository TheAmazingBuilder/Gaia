import { db } from "@/lib/db";
import type { Note, NoteFolder, NoteTag, Prisma } from "@prisma/client";
import {
  countOpenTodos,
  excerptOf,
  flattenBlocks,
  parseJsonBlocks,
  parseJsonStringArray,
  textOfBlocks,
  gaiaRefKindSchema,
} from "@/lib/gaia/content";
import {
  buildTree,
  descendantIds,
  matchCollectionCriteria,
  type KnowledgeCollectionCriteria,
} from "@/lib/gaia/knowledge";
import { isMasteryLevel, isTimePeriod, periodOf, type TimePeriod } from "@/lib/gaia/spaced-repetition";
import type { GaiaListQuery, GaiaNoteRow } from "@/modules/notes/types";
import { NOTE_LIST_SELECT, type NoteListRow, type NoteRowInput } from "@/modules/notes/types/list";
export { NOTE_LIST_SELECT };
export type { NoteListRow, NoteRowInput };
import { loadFolders, loadTags } from "@/modules/notes/repositories/notes";



type ListNotesDependencies = {
  validationError: (message: string) => Error;
  collectionNotFound: () => Error;
  collectionCriteriaSchema: {
    safeParse: (input: unknown) =>
      | { success: true; data: KnowledgeCollectionCriteria }
      | { success: false; error: unknown };
  };
  parseJsonProperties: (raw: string | null | undefined) => Array<{
    key: string;
    value: string;
    type: "text" | "number" | "date" | "checkbox" | "select";
    options?: string[];
  }>;
  toRow: (note: NoteRowInput, folders: NoteFolder[], tags: NoteTag[]) => GaiaNoteRow;
};

function folderNameOf(folderId: string | null, folders: NoteFolder[]): string | null {
  if (folderId === null) return null;
  return folders.find((folder) => folder.id === folderId)?.name ?? null;
}

function tagNamesOf(tagIds: string[], tags: NoteTag[]): string[] {
  return tagIds
    .map((tagId) => tags.find((tag) => tag.id === tagId)?.name ?? null)
    .filter((name): name is string => name !== null);
}

/** Charge les métadonnées de notes nécessaires au calcul de l'aperçu Knowledge. */
export async function loadOverviewNotesQuery(userId: string): Promise<NoteListRow[]> {
  return db.note.findMany({ where: { userId }, select: NOTE_LIST_SELECT });
}

/** Charge les notes actives avec leur contenu pour la recherche textuelle. */
export async function loadSearchNotesQuery(userId: string): Promise<NoteRowInput[]> {
  return db.note.findMany({
    where: { userId, deletedAt: null },
    select: { ...NOTE_LIST_SELECT, blocks: true },
  });
}

export async function loadBlocksFor(noteIds: string[]): Promise<Map<string, string>> {
  if (noteIds.length === 0) return new Map();
  const rows = await db.note.findMany({
    where: { id: { in: noteIds } },
    select: { id: true, blocks: true },
  });
  return new Map(rows.map((row) => [row.id, row.blocks]));
}

function pageWindow(query: GaiaListQuery): { page: number; pageSize: number } {
  const page = Math.max(1, Math.floor(query.page ?? 1) || 1);
  const pageSize = Math.min(100, Math.max(1, Math.floor(query.pageSize ?? 50) || 50));
  return { page, pageSize };
}

function sortOrderBy(sort: string): Prisma.NoteOrderByWithRelationInput[] {
  if (sort === "created") return [{ createdAt: "desc" }, { id: "desc" }];
  if (sort === "title") return [{ title: "asc" }, { id: "desc" }];
  if (sort === "viewed") {
    return [{ lastViewedAt: { sort: "desc", nulls: "last" } }, { id: "desc" }];
  }
  return [{ updatedAt: "desc" }, { id: "desc" }];
}

function memoryMatches(
  note: Pick<Note, "mastery" | "nextReviewAt">,
  query: GaiaListQuery,
  now: Date,
  validationError: ListNotesDependencies["validationError"],
): boolean {
  if (query.mastery !== undefined && query.mastery !== "") {
    if (!isMasteryLevel(query.mastery)) throw validationError("Invalid mastery level.");
    if (note.mastery !== query.mastery) return false;
  }
  if (query.due === true) {
    if (note.nextReviewAt !== null && note.nextReviewAt.getTime() > now.getTime()) return false;
  }
  if (query.period !== undefined && query.period !== "") {
    if (!isTimePeriod(query.period)) throw validationError("Invalid time period.");
    if (periodOf(note.nextReviewAt, now) !== query.period) return false;
  }
  return true;
}

function safeJsonParse(raw: string | null | undefined): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

export async function listNotesQuery(
  userId: string,
  query: GaiaListQuery,
  deps: ListNotesDependencies,
): Promise<{ notes: GaiaNoteRow[]; total: number }> {
  const [folders, tags] = await Promise.all([loadFolders(userId), loadTags(userId)]);
  const { page, pageSize } = pageWindow(query);

  if (query.collectionId !== undefined && query.collectionId !== "") {
    const collection = await db.smartCollection.findFirst({
      where: { userId, id: query.collectionId },
    });
    if (!collection) throw deps.collectionNotFound();
    const rawCriteria = safeJsonParse(collection.criteria);
    const parsedCriteria = deps.collectionCriteriaSchema.safeParse(rawCriteria);
    const criteria: KnowledgeCollectionCriteria = parsedCriteria.success
      ? parsedCriteria.data
      : {};
    const folderDescendants = criteria.folderId != null
      ? descendantIds(buildTree(folders), criteria.folderId, false)
      : [];
    const now = new Date();
    const all = await db.note.findMany({ where: { userId, deletedAt: null } });
    const filtered = all.filter((note) =>
      memoryMatches(note, query, now, deps.validationError) &&
      matchCollectionCriteria(
        {
          folderId: note.folderId,
          tagIds: parseJsonStringArray(note.tagIds),
          mastery: note.mastery,
          favorite: note.favorite,
          title: note.title,
          text: textOfBlocks(parseJsonBlocks(note.blocks)),
          properties: deps.parseJsonProperties(note.properties),
        },
        criteria,
        folderDescendants,
      ),
    );
    const sorted = [...filtered].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    const total = sorted.length;
    const pageNotes = sorted.slice((page - 1) * pageSize, page * pageSize);
    return { notes: pageNotes.map((note) => deps.toRow(note, folders, tags)), total };
  }

  if (query.refKind !== undefined && query.refId !== undefined) {
    const parsedKind = gaiaRefKindSchema.safeParse(query.refKind);
    if (!parsedKind.success) throw deps.validationError("Invalid reference type.");
    const kind = parsedKind.data;
    const all = await db.note.findMany({ where: { userId } });
    const now = new Date();
    const linked = all.filter((note) =>
      note.deletedAt === null &&
      memoryMatches(note, query, now, deps.validationError) &&
      flattenBlocks(parseJsonBlocks(note.blocks)).some(
        (block) => block.type === "ref" && block.ref?.kind === kind && block.ref.id === query.refId,
      ),
    );
    const sorted = linked.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    const total = sorted.length;
    const pageNotes = sorted.slice((page - 1) * pageSize, page * pageSize);
    return { notes: pageNotes.map((note) => deps.toRow(note, folders, tags)), total };
  }

  const view = query.view ?? "all";
  const where: Prisma.NoteWhereInput = { userId };
  if (view === "trash") {
    where.deletedAt = { not: null };
  } else {
    where.deletedAt = null;
    if (view === "favorites") where.favorite = true;
    else if (view === "recent") where.lastViewedAt = { not: null };
    else if (view === "folder" && query.folderId) where.folderId = query.folderId;
    else if (view === "tag" && query.tagId) where.tagIds = { contains: `"${query.tagId}"` };

    if (query.mastery !== undefined && query.mastery !== "") {
      if (!isMasteryLevel(query.mastery)) throw deps.validationError("Invalid mastery level.");
      where.mastery = query.mastery;
    }
    if (query.period !== undefined && query.period !== "") {
      if (!isTimePeriod(query.period)) throw deps.validationError("Invalid time period.");
      const now = new Date();
      const in7 = new Date(now.getTime() + 7 * 86_400_000);
      const in30 = new Date(now.getTime() + 30 * 86_400_000);
      const period: TimePeriod = query.period;
      if (period === "today") {
        where.OR = [{ nextReviewAt: null }, { nextReviewAt: { lte: now } }];
      } else if (period === "week") {
        where.nextReviewAt = { gt: now, lte: in7 };
      } else if (period === "month") {
        where.nextReviewAt = { gt: in7, lte: in30 };
      } else {
        where.nextReviewAt = { gt: in30 };
      }
    } else if (query.due === true) {
      where.OR = [{ nextReviewAt: null }, { nextReviewAt: { lte: new Date() } }];
    }
  }

  const q = (query.q ?? "").trim().toLowerCase();
  if (q !== "") {
    const scoped = await db.note.findMany({ where });
    const filtered = scoped.filter((note) => {
      const blocks = parseJsonBlocks(note.blocks);
      const tagIds = parseJsonStringArray(note.tagIds);
      return (
        note.title.toLowerCase().includes(q) ||
        textOfBlocks(blocks).toLowerCase().includes(q) ||
        tagNamesOf(tagIds, tags).some((name) => name.toLowerCase().includes(q)) ||
        (folderNameOf(note.folderId, folders) ?? "").toLowerCase().includes(q)
      );
    });
    const sort = query.sort ?? "updated";
    const sorted = [...filtered].sort((a, b) => {
      if (sort === "created") return b.createdAt.getTime() - a.createdAt.getTime();
      if (sort === "title") return a.title.localeCompare(b.title);
      if (sort === "viewed") return (b.lastViewedAt?.getTime() ?? 0) - (a.lastViewedAt?.getTime() ?? 0);
      return b.updatedAt.getTime() - a.updatedAt.getTime();
    });
    const total = sorted.length;
    const pageNotes = sorted.slice((page - 1) * pageSize, page * pageSize);
    return { notes: pageNotes.map((note) => deps.toRow(note, folders, tags)), total };
  }

  const [total, pageRows] = await Promise.all([
    db.note.count({ where }),
    db.note.findMany({
      where,
      select: NOTE_LIST_SELECT,
      orderBy: sortOrderBy(query.sort ?? "updated"),
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  const blocksById = await loadBlocksFor(pageRows.map((note) => note.id));
  return {
    notes: pageRows.map((note) =>
      deps.toRow({ ...note, blocks: blocksById.get(note.id) ?? "[]" }, folders, tags),
    ),
    total,
  };
}
