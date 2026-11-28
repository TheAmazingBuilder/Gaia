import type { Note, NoteFolder, NoteTag } from "@prisma/client";
import {
  countOpenTodos,
  countWords,
  excerptOf,
  flattenBlocks,
  parseJsonBlocks,
  parseJsonStringArray,
} from "@/lib/gaia/content";
import { resolveNoteRefs } from "@/lib/gaia/refs";
import { isMasteryLevel } from "@/lib/gaia/spaced-repetition";
import { gaiaNotePropertySchema } from "@/modules/notes/schemas";
import type {
  GaiaNoteDTO,
  GaiaNoteProperty,
  GaiaNoteResponse,
  GaiaNoteRow,
} from "@/modules/notes/types";
import type { NoteRowInput } from "@/modules/notes/services/list";

export function parseJsonProperties(raw: string | null | undefined): GaiaNoteProperty[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: GaiaNoteProperty[] = [];
    for (const item of parsed) {
      const checked = gaiaNotePropertySchema.safeParse(item);
      if (checked.success) out.push(checked.data);
    }
    return out;
  } catch {
    return [];
  }
}

function folderNameOf(folderId: string | null, folders: NoteFolder[]): string | null {
  if (folderId === null) return null;
  return folders.find((folder) => folder.id === folderId)?.name ?? null;
}

export function tagNamesOf(tagIds: string[], tags: NoteTag[]): string[] {
  return tagIds
    .map((tagId) => tags.find((tag) => tag.id === tagId)?.name ?? null)
    .filter((name): name is string => name !== null);
}

export function toRow(
  note: NoteRowInput,
  folders: NoteFolder[],
  tags: NoteTag[],
): GaiaNoteRow {
  const blocks = parseJsonBlocks(note.blocks);
  const tagIds = parseJsonStringArray(note.tagIds);
  return {
    id: note.id,
    title: note.title,
    icon: note.icon,
    folderId: note.folderId,
    folderName: folderNameOf(note.folderId, folders),
    tagIds,
    tagNames: tagNamesOf(tagIds, tags),
    favorite: note.favorite,
    templateId: note.templateId,
    excerpt: excerptOf(blocks),
    wordCount: countWords(blocks),
    blockCount: flattenBlocks(blocks).length,
    refCount: flattenBlocks(blocks).filter((block) => block.type === "ref").length,
    todoOpen: countOpenTodos(blocks),
    cover: note.cover ?? null,
    wordGoal: note.wordGoal ?? null,
    properties: parseJsonProperties(note.properties),
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
    lastViewedAt: note.lastViewedAt?.toISOString() ?? null,
    deletedAt: note.deletedAt?.toISOString() ?? null,
    mastery: isMasteryLevel(note.mastery) ? note.mastery : "fragile",
    lastReviewedAt: note.lastReviewedAt?.toISOString() ?? null,
    nextReviewAt: note.nextReviewAt?.toISOString() ?? null,
    reviewCount: note.reviewCount,
    easeFactor: note.easeFactor,
    intervalDays: note.intervalDays,
  };
}

export function toDTO(note: Note): GaiaNoteDTO {
  return {
    id: note.id,
    userId: note.userId,
    title: note.title,
    icon: note.icon,
    folderId: note.folderId,
    tagIds: parseJsonStringArray(note.tagIds),
    favorite: note.favorite,
    templateId: note.templateId,
    blocks: parseJsonBlocks(note.blocks),
    cover: note.cover ?? null,
    wordGoal: note.wordGoal ?? null,
    properties: parseJsonProperties(note.properties),
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
    lastViewedAt: note.lastViewedAt?.toISOString() ?? null,
    deletedAt: note.deletedAt?.toISOString() ?? null,
    mastery: isMasteryLevel(note.mastery) ? note.mastery : "fragile",
    lastReviewedAt: note.lastReviewedAt?.toISOString() ?? null,
    nextReviewAt: note.nextReviewAt?.toISOString() ?? null,
    reviewCount: note.reviewCount,
    easeFactor: note.easeFactor,
    intervalDays: note.intervalDays,
  };
}

export async function noteResponse(
  userId: string,
  note: Note,
  folders: NoteFolder[],
  tags: NoteTag[],
): Promise<GaiaNoteResponse> {
  const dto = toDTO(note);
  dto.blocks = await resolveNoteRefs(userId, dto.blocks);
  return {
    note: dto,
    folderName: folderNameOf(note.folderId, folders),
    tagNames: tagNamesOf(dto.tagIds, tags),
  };
}
