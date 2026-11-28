import {
  createUserSmartCollection,
  deleteUserSmartCollection,
  findUserCollectionFolder,
  findUserSmartCollection,
  listUserSmartCollections,
  loadSmartCollectionNotes,
  updateUserSmartCollection,
} from "@/modules/knowledge/repositories/collections";
import {
  parseJsonBlocks,
  parseJsonStringArray,
  textOfBlocks,
} from "@/lib/gaia/content";
import {
  buildTree,
  descendantIds,
  matchCollectionCriteria,
  type KnowledgeCollectionCriteria,
} from "@/lib/gaia/knowledge";
import {
  collectionInputSchema,
  gaiaCollectionCriteriaSchema,
} from "@/modules/knowledge/schemas";
import type { GaiaSmartCollectionDTO } from "@/modules/knowledge/types";
import type { GaiaListQuery, GaiaNoteRow } from "@/modules/notes/types";
import type { NoteFolder, SmartCollection } from "@prisma/client";
import { parseOrThrow } from "@/shared/validation/parse-or-throw";

type CollectionDependencies = {
  validationError: (
    message: string,
    issues?: { path: string; message: string }[],
  ) => Error;
  collectionNotFound: () => Error;
  folderNotFound: () => Error;
  loadFolders: (userId: string) => Promise<NoteFolder[]>;
  parseJsonProperties: (raw: string | null | undefined) => Array<{ key: string; value: string }>;
  listNotes: (userId: string, query: GaiaListQuery) => Promise<{ notes: GaiaNoteRow[]; total: number }>;
};

function safeJsonParse(raw: string | null | undefined): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function parseCriteria(raw: string): KnowledgeCollectionCriteria {
  const parsed = gaiaCollectionCriteriaSchema.safeParse(safeJsonParse(raw));
  return parsed.success ? parsed.data : {};
}

function collectionToDTO(
  row: SmartCollection,
  noteCount: number,
): GaiaSmartCollectionDTO {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon,
    criteria: parseCriteria(row.criteria),
    noteCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function countCollectionNotes(
  userId: string,
  criteria: KnowledgeCollectionCriteria,
  deps: CollectionDependencies,
): Promise<number> {
  const [folders, allNotes] = await Promise.all([
    deps.loadFolders(userId),
    loadSmartCollectionNotes(userId),
  ]);
  const folderDescendants =
    criteria.folderId != null
      ? descendantIds(buildTree(folders), criteria.folderId, false)
      : [];
  return allNotes.filter((note) =>
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
  ).length;
}

export async function listCollectionsQuery(
  userId: string,
  deps: CollectionDependencies,
): Promise<{ collections: GaiaSmartCollectionDTO[] }> {
  const rows = await listUserSmartCollections(userId);
  const collections: GaiaSmartCollectionDTO[] = [];
  for (const row of rows) {
    const criteria = parseCriteria(row.criteria);
    collections.push(
      collectionToDTO(row, await countCollectionNotes(userId, criteria, deps)),
    );
  }
  return { collections };
}

export async function createCollectionCommand(
  userId: string,
  input: unknown,
  deps: CollectionDependencies,
): Promise<{ collection: GaiaSmartCollectionDTO }> {
  const parsed = parseOrThrow(collectionInputSchema, input, deps.validationError);
  if (parsed.criteria?.folderId) {
    const folder = await findUserCollectionFolder(userId, parsed.criteria.folderId);
    if (!folder) throw deps.folderNotFound();
  }
  const row = await createUserSmartCollection(
    userId,
    parsed.name.trim(),
    parsed.icon ?? "📁",
    JSON.stringify(parsed.criteria ?? {}),
  );
  return { collection: collectionToDTO(row, 0) };
}

export async function updateCollectionCommand(
  userId: string,
  collectionId: string,
  input: unknown,
  deps: CollectionDependencies,
): Promise<{ collection: GaiaSmartCollectionDTO }> {
  const parsed = parseOrThrow(collectionInputSchema, input, deps.validationError);
  const row = await findUserSmartCollection(userId, collectionId);
  if (!row) throw deps.collectionNotFound();
  if (parsed.criteria?.folderId) {
    const folder = await findUserCollectionFolder(userId, parsed.criteria.folderId);
    if (!folder) throw deps.folderNotFound();
  }
  const updated = await updateUserSmartCollection(
    row.id,
    parsed.name.trim(),
    parsed.icon ?? row.icon,
    JSON.stringify(parsed.criteria ?? {}),
  );
  const criteria = gaiaCollectionCriteriaSchema.parse(safeJsonParse(updated.criteria)) as KnowledgeCollectionCriteria;
  return {
    collection: collectionToDTO(
      updated,
      await countCollectionNotes(userId, criteria, deps),
    ),
  };
}

export async function deleteCollectionCommand(
  userId: string,
  collectionId: string,
  deps: Pick<CollectionDependencies, "collectionNotFound">,
): Promise<{ ok: true }> {
  const row = await findUserSmartCollection(userId, collectionId);
  if (!row) throw deps.collectionNotFound();
  await deleteUserSmartCollection(row.id);
  return { ok: true };
}

export async function listCollectionNotesQuery(
  userId: string,
  collectionId: string,
  page: number,
  deps: CollectionDependencies,
): Promise<{ notes: GaiaNoteRow[]; total: number; collection: GaiaSmartCollectionDTO }> {
  const { notes, total } = await deps.listNotes(userId, {
    collectionId,
    page,
    pageSize: 50,
  });
  const row = await findUserSmartCollection(userId, collectionId);
  if (!row) throw deps.collectionNotFound();
  return {
    notes,
    total,
    collection: collectionToDTO(row, total),
  };
}
