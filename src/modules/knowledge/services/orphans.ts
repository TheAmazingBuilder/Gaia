import { db } from "@/shared/database/client";
import { flattenBlocks, parseJsonBlocks, parseJsonStringArray } from "@/lib/gaia/content";
import type { Note, NoteFolder, NoteRelation, NoteTag } from "@prisma/client";
import type { GaiaNoteRow } from "@/modules/notes/types";

type OrphanNotesDependencies = {
  loadFolders: (userId: string) => Promise<NoteFolder[]>;
  loadTags: (userId: string) => Promise<NoteTag[]>;
  loadRelations: (userId: string) => Promise<NoteRelation[]>;
  toRow: (note: Note, folders: NoteFolder[], tags: NoteTag[]) => GaiaNoteRow;
};

export async function getOrphanNotesQuery(
  userId: string,
  deps: OrphanNotesDependencies,
): Promise<{ notes: GaiaNoteRow[]; total: number }> {
  const [folders, tags, relations, allNotes] = await Promise.all([
    deps.loadFolders(userId),
    deps.loadTags(userId),
    deps.loadRelations(userId),
    db.note.findMany({ where: { userId, deletedAt: null } }),
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
