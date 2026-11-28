import { loadNoteLinkCandidates } from "@/modules/knowledge/repositories/links";
import { flattenBlocks } from "@/lib/gaia/tree";
import { parseJsonBlocks } from "@/lib/gaia/block-serialization";
import { excerptOf, searchSnippet, textOfBlocks } from "@/lib/gaia/text";
import type { GaiaNoteLinksResponse } from "@/modules/knowledge/types";
import type { Note, NoteFolder, NoteRelation, NoteTag } from "@prisma/client";
import type { GaiaNoteRow } from "@/modules/notes/types";

type NoteLinksDependencies = {
  findActiveNote: (userId: string, noteId: string) => Promise<Note | null>;
  loadFolders: (userId: string) => Promise<NoteFolder[]>;
  loadTags: (userId: string) => Promise<NoteTag[]>;
  loadRelations: (userId: string) => Promise<NoteRelation[]>;
  loadNoteTitles: (userId: string, ids: string[]) => Promise<Map<string, string>>;
  toRow: (note: Note, folders: NoteFolder[], tags: NoteTag[]) => GaiaNoteRow;
  noteNotFound: () => Error;
};

function relationToDTO(
  relation: NoteRelation,
  direction: "outgoing" | "incoming",
  otherTitle: string,
) {
  const otherNoteId = direction === "outgoing" ? relation.toNoteId : relation.fromNoteId;
  return {
    id: relation.id,
    fromNoteId: relation.fromNoteId,
    toNoteId: relation.toNoteId,
    type: relation.type,
    direction,
    otherNoteId,
    otherTitle,
    createdAt: relation.createdAt.toISOString(),
  };
}

export async function getNoteLinksQuery(
  userId: string,
  noteId: string,
  deps: NoteLinksDependencies,
): Promise<GaiaNoteLinksResponse> {
  const note = await deps.findActiveNote(userId, noteId);
  if (!note) throw deps.noteNotFound();

  const [folders, tags, relations, allNotes] = await Promise.all([
    deps.loadFolders(userId),
    deps.loadTags(userId),
    deps.loadRelations(userId),
    loadNoteLinkCandidates(userId),
  ]);

  const outgoing: GaiaNoteLinksResponse["outgoing"] = [];
  const seenOutgoing = new Set<string>();

  for (const block of flattenBlocks(parseJsonBlocks(note.blocks))) {
    if (block.type !== "ref" || block.ref?.kind !== "NOTE") continue;
    const target = allNotes.find((candidate) => candidate.id === block.ref?.id);
    if (!target || target.id === noteId || seenOutgoing.has(target.id)) continue;
    seenOutgoing.add(target.id);
    outgoing.push({
      id: target.id,
      title: target.title === "" ? "Untitled note" : target.title,
      via: "ref",
    });
  }

  for (const relation of relations.filter((item) => item.fromNoteId === noteId)) {
    const target = allNotes.find((candidate) => candidate.id === relation.toNoteId);
    if (!target || seenOutgoing.has(target.id)) continue;
    seenOutgoing.add(target.id);
    outgoing.push({
      id: target.id,
      title: target.title === "" ? "Untitled note" : target.title,
      via: "relation",
      relationType: relation.type,
    });
  }

  const backlinks = allNotes
    .filter(
      (candidate) =>
        candidate.id !== noteId &&
        flattenBlocks(parseJsonBlocks(candidate.blocks)).some(
          (block) =>
            block.type === "ref" &&
            block.ref?.kind === "NOTE" &&
            block.ref.id === noteId,
        ),
    )
    .map((candidate) => deps.toRow(candidate, folders, tags));

  const unlinkedMentions: GaiaNoteLinksResponse["unlinkedMentions"] = [];
  const title = note.title.trim();
  if (title.length >= 3) {
    const needle = title.toLowerCase();
    const linkedIds = new Set([
      ...backlinks.map((backlink) => backlink.id),
      ...outgoing.map((link) => link.id),
    ]);

    for (const other of allNotes) {
      if (other.id === noteId || linkedIds.has(other.id)) continue;
      const blocks = parseJsonBlocks(other.blocks);
      const hayTitle = other.title.toLowerCase();
      const hayText = textOfBlocks(blocks).toLowerCase();
      if (!hayTitle.includes(needle) && !hayText.includes(needle)) continue;

      unlinkedMentions.push({
        id: other.id,
        title: other.title === "" ? "Untitled note" : other.title,
        snippet: hayText.includes(needle)
          ? searchSnippet(blocks, needle)
          : excerptOf(blocks),
      });
      if (unlinkedMentions.length >= 20) break;
    }
  }

  const relationRows = relations.filter(
    (relation) => relation.fromNoteId === noteId || relation.toNoteId === noteId,
  );
  const titles = await deps.loadNoteTitles(
    userId,
    relationRows.map((relation) =>
      relation.fromNoteId === noteId ? relation.toNoteId : relation.fromNoteId,
    ),
  );
  const relationDTOs = relationRows.map((relation) =>
    relationToDTO(
      relation,
      relation.fromNoteId === noteId ? "outgoing" : "incoming",
      titles.get(
        relation.fromNoteId === noteId ? relation.toNoteId : relation.fromNoteId,
      ) ?? "Untitled note",
    ),
  );

  return { outgoing, backlinks, unlinkedMentions, relations: relationDTOs };
}
