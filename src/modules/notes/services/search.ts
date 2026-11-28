import type { GaiaNoteRow } from "@/modules/notes/types";
import type { NoteFolder, NoteTag } from "@prisma/client";
import type { GaiaBlock } from "@/lib/gaia/content";
import type { NoteRowInput } from "@/modules/notes/services/list";

type SearchNotesDependencies = {
  loadFolders: (userId: string) => Promise<NoteFolder[]>;
  loadTags: (userId: string) => Promise<NoteTag[]>;
  loadNotes: (userId: string) => Promise<NoteRowInput[]>;
  parseBlocks: (stored: string | null | undefined) => GaiaBlock[];
  parseTagIds: (raw: string | null | undefined) => string[];
  textOfBlocks: (blocks: GaiaBlock[]) => string;
  searchSnippet: (blocks: GaiaBlock[], query: string) => string;
  excerptOf: (blocks: GaiaBlock[]) => string;
  tagNamesOf: (tagIds: string[], tags: NoteTag[]) => string[];
  toRow: (note: NoteRowInput, folders: NoteFolder[], tags: NoteTag[]) => GaiaNoteRow;
};

export async function searchNotesQuery(
  userId: string,
  q: string,
  deps: SearchNotesDependencies,
): Promise<{ results: (GaiaNoteRow & { snippet: string })[]; total: number }> {
  const query = q.trim().toLowerCase();
  if (query === "") return { results: [], total: 0 };

  const [folders, tags, notes] = await Promise.all([
    deps.loadFolders(userId),
    deps.loadTags(userId),
    deps.loadNotes(userId),
  ]);
  const results: (GaiaNoteRow & { snippet: string })[] = [];

  for (const note of notes) {
    const blocks = deps.parseBlocks(note.blocks);
    const tagIds = deps.parseTagIds(note.tagIds);
    const titleHit = note.title.toLowerCase().includes(query);
    const fullText = deps.textOfBlocks(blocks);
    const textHit = fullText.toLowerCase().includes(query);
    const tagHit = deps.tagNamesOf(tagIds, tags).some((name) =>
      name.toLowerCase().includes(query),
    );
    if (!titleHit && !textHit && !tagHit) continue;

    const row = deps.toRow(note, folders, tags);
    results.push({
      ...row,
      snippet: textHit ? deps.searchSnippet(blocks, query) : deps.excerptOf(blocks),
    });
  }

  results.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const sliced = results.slice(0, 30);
  return { results: sliced, total: sliced.length };
}
