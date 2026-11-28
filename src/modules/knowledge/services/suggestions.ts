import { db } from "@/shared/database/client";
import {
  parseJsonBlocks,
  parseJsonStringArray,
  textOfBlocks,
} from "@/lib/gaia/content";
import { suggestLinks } from "@/lib/gaia/knowledge";
import type { GaiaLinkSuggestion } from "@/modules/knowledge/types";
import type { Note } from "@prisma/client";

type LinkSuggestionDependencies = {
  findActiveNote: (userId: string, noteId: string) => Promise<Note | null>;
  getNoteLinks: (userId: string, noteId: string) => Promise<{
    outgoing: Array<{ id: string }>;
    backlinks: Array<{ id: string }>;
  }>;
  noteNotFound: () => Error;
};

export async function getLinkSuggestionsQuery(
  userId: string,
  noteId: string,
  deps: LinkSuggestionDependencies,
): Promise<{ suggestions: GaiaLinkSuggestion[] }> {
  const note = await deps.findActiveNote(userId, noteId);
  if (!note) throw deps.noteNotFound();

  const [links, allNotes] = await Promise.all([
    deps.getNoteLinks(userId, noteId),
    db.note.findMany({ where: { userId, deletedAt: null } }),
  ]);

  const linkedIds = new Set([
    noteId,
    ...links.outgoing.map((link) => link.id),
    ...links.backlinks.map((backlink) => backlink.id),
  ]);
  const sourceBlocks = parseJsonBlocks(note.blocks);
  const scored = suggestLinks(
    {
      title: note.title,
      text: textOfBlocks(sourceBlocks),
      tagIds: parseJsonStringArray(note.tagIds),
    },
    allNotes
      .filter((candidate) => !linkedIds.has(candidate.id))
      .map((candidate) => ({
        id: candidate.id,
        title: candidate.title,
        text: textOfBlocks(parseJsonBlocks(candidate.blocks)),
        tagIds: parseJsonStringArray(candidate.tagIds),
      })),
    8,
  );

  const titles = new Map(allNotes.map((candidate) => [candidate.id, candidate.title]));
  return {
    suggestions: scored.map((suggestion) => ({
      id: suggestion.id,
      title:
        titles.get(suggestion.id) === ""
          ? "Untitled note"
          : (titles.get(suggestion.id) ?? "Untitled note"),
      score: suggestion.score,
      sharedWords: suggestion.sharedWords,
    })),
  };
}
