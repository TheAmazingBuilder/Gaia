import { loadOrphanDetectionNotes } from "@/modules/knowledge/repositories/orphans";
import { flattenBlocks, parseJsonBlocks, parseJsonStringArray } from "@/lib/gaia/content";
import type { GaiaNoteRow } from "@/modules/notes/types";
import type {
  NoteFolderMappingRecord,
  NoteRowInput,
  NoteTagMappingRecord,
} from "@/modules/notes/types/list";

type NoteRelationRecord = {
  id: string;
  fromNoteId: string;
  toNoteId: string;
  type: string;
  createdAt: Date;
};

type OrphanNotesDependencies = {
  loadFolders: (userId: string) => Promise<NoteFolderMappingRecord[]>;
  loadTags: (userId: string) => Promise<NoteTagMappingRecord[]>;
  loadRelations: (userId: string) => Promise<NoteRelationRecord[]>;
  toRow: (
    note: NoteRowInput,
    folders: NoteFolderMappingRecord[],
    tags: NoteTagMappingRecord[],
  ) => GaiaNoteRow;
};

export async function getOrphanNotesQuery(
  userId: string,
  deps: OrphanNotesDependencies,
): Promise<{ notes: GaiaNoteRow[]; total: number }> {
  const [folders, tags, relations, allNotes] = await Promise.all([
    deps.loadFolders(userId),
    deps.loadTags(userId),
    deps.loadRelations(userId),
    loadOrphanDetectionNotes(userId),
  ]);

  const outgoing = new Map<string, Set<string>>();
  const incoming = new Set<string>();
  const tagGroups = new Map<string, string[]>();

  for (const note of allNotes) {
    const targets = new Set<string>();
    for (const block of flattenBlocks(parseJsonBlocks(note.blocks))) {
      if (
        block.type === "ref" &&
        block.ref?.kind === "NOTE" &&
        block.ref.id !== note.id
      ) {
        targets.add(block.ref.id);
        incoming.add(block.ref.id);
      }
    }
    outgoing.set(note.id, targets);

    for (const tagId of parseJsonStringArray(note.tagIds)) {
      const members = tagGroups.get(tagId) ?? [];
      members.push(note.id);
      tagGroups.set(tagId, members);
    }
  }

  const relatedIds = new Set<string>();
  for (const relation of relations) {
    relatedIds.add(relation.fromNoteId);
    relatedIds.add(relation.toNoteId);
  }

  const sharedTagIds = new Set<string>();
  for (const members of tagGroups.values()) {
    if (members.length >= 2) {
      for (const id of members) sharedTagIds.add(id);
    }
  }

  const orphans = allNotes.filter(
    (note) =>
      (outgoing.get(note.id)?.size ?? 0) === 0 &&
      !incoming.has(note.id) &&
      !relatedIds.has(note.id) &&
      !sharedTagIds.has(note.id),
  );
  orphans.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

  const total = orphans.length;
  return {
    notes: orphans.slice(0, 50).map((note) => deps.toRow(note, folders, tags)),
    total,
  };
}
