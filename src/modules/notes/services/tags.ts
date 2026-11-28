import { db } from "@/shared/database/client";
import type { NoteTag } from "@prisma/client";

export type GaiaTagInput = {
  name?: string;
  parentId?: string | null;
  relatedIds?: string[];
};

export type GaiaTagDTO = NoteTag & { noteCount: number };

type TagErrorDependencies = {
  notFound: (code: string, message: string) => Error;
  validationError: (message: string, issues?: { path: string; message: string }[]) => Error;
  conflictError: (code: string, message: string) => Error;
  parseJsonStringArray: (raw: string | null | undefined) => string[];
};

type TagTreeDependencies = TagErrorDependencies & {
  isDescendantOf: (tags: NoteTag[], candidateId: string, ancestorId: string) => boolean;
};

type TagDeleteDependencies = Pick<TagErrorDependencies, "notFound"> & {
  parseJsonStringArray: (raw: string | null | undefined) => string[];
};

function normalizeTagName(name: string): string {
  return name.trim().replace(/^#/, "");
}

function nameKeyOf(name: string): string {
  return name.trim().toLowerCase();
}

async function loadTags(userId: string): Promise<NoteTag[]> {
  return db.noteTag.findMany({ where: { userId } });
}

async function countNotesWithTag(
  userId: string,
  tagId: string,
  parseJsonStringArray: (raw: string | null | undefined) => string[],
): Promise<number> {
  const notes = await db.note.findMany({ where: { userId, deletedAt: null } });
  return notes.filter((note) => parseJsonStringArray(note.tagIds).includes(tagId)).length;
}

export async function listTagsQuery(
  userId: string,
  parseJsonStringArray: (raw: string | null | undefined) => string[],
): Promise<{ tags: GaiaTagDTO[] }> {
  const [tags, notes] = await Promise.all([
    loadTags(userId),
    db.note.findMany({ where: { userId, deletedAt: null } }),
  ]);
  const withCounts = tags.map((tag) => ({
    ...tag,
    noteCount: notes.filter((note) => parseJsonStringArray(note.tagIds).includes(tag.id)).length,
  }));
  withCounts.sort((a, b) => b.noteCount - a.noteCount || a.name.localeCompare(b.name));
  return { tags: withCounts };
}

export async function createTagCommand(
  userId: string,
  parsed: GaiaTagInput,
  deps: TagErrorDependencies,
): Promise<GaiaTagDTO> {
  const name = normalizeTagName(parsed.name ?? "");
  if (name === "") {
    throw deps.validationError("The tag name is required.", [
      { path: "name", message: "The tag name is required." },
    ]);
  }
  const tags = await loadTags(userId);
  const existing = tags.find((tag) => nameKeyOf(tag.name) === nameKeyOf(name));
  if (existing) {
    return {
      ...existing,
      noteCount: await countNotesWithTag(userId, existing.id, deps.parseJsonStringArray),
    };
  }
  let parentId: string | null = null;
  if (parsed.parentId !== undefined && parsed.parentId !== null) {
    const parent = tags.find((tag) => tag.id === parsed.parentId);
    if (!parent) throw deps.notFound("TAG_NOT_FOUND", "Tag not found.");
    parentId = parent.id;
  }
  const relatedIds = (parsed.relatedIds ?? []).filter((id) => tags.some((tag) => tag.id === id));
  const tag = await db.noteTag.create({
    data: { userId, name, parentId, relatedIds: JSON.stringify(relatedIds) },
  });
  return { ...tag, noteCount: 0 };
}

export async function updateTagCommand(
  userId: string,
  tagId: string,
  parsed: GaiaTagInput,
  deps: TagTreeDependencies,
): Promise<GaiaTagDTO> {
  const tag = await db.noteTag.findFirst({ where: { userId, id: tagId } });
  if (!tag) throw deps.notFound("TAG_NOT_FOUND", "Tag not found.");
  const tags = await loadTags(userId);
  const data: { name?: string; parentId?: string | null; relatedIds?: string } = {};
  if (parsed.name !== undefined) {
    const name = normalizeTagName(parsed.name);
    if (name === "") {
      throw deps.validationError("The tag name is required.", [
        { path: "name", message: "The tag name is required." },
      ]);
    }
    if (tags.some((item) => item.id !== tag.id && nameKeyOf(item.name) === nameKeyOf(name))) {
      throw deps.conflictError("TAG_EXISTS", "A tag with this name already exists.");
    }
    data.name = name;
  }
  if (parsed.parentId !== undefined) {
    if (parsed.parentId === null) {
      data.parentId = null;
    } else {
      const parent = tags.find((item) => item.id === parsed.parentId);
      if (!parent) throw deps.notFound("TAG_NOT_FOUND", "Tag not found.");
      if (parent.id === tag.id || deps.isDescendantOf(tags, parent.id, tag.id)) {
        throw deps.validationError("A tag cannot be moved under itself or one of its children.");
      }
      data.parentId = parent.id;
    }
  }
  if (parsed.relatedIds !== undefined) {
    const known = new Set(tags.map((item) => item.id));
    data.relatedIds = JSON.stringify(
      parsed.relatedIds.filter((id) => id !== tag.id && known.has(id)),
    );
  }
  const updated = await db.noteTag.update({ where: { id: tag.id }, data });
  return {
    ...updated,
    noteCount: await countNotesWithTag(userId, updated.id, deps.parseJsonStringArray),
  };
}

export async function deleteTagCommand(
  userId: string,
  tagId: string,
  deps: TagDeleteDependencies,
): Promise<{ ok: true }> {
  const tag = await db.noteTag.findFirst({ where: { userId, id: tagId } });
  if (!tag) throw deps.notFound("TAG_NOT_FOUND", "Tag not found.");
  await db.noteTag.updateMany({
    where: { userId, parentId: tag.id },
    data: { parentId: null },
  });
  const others = await db.noteTag.findMany({ where: { userId } });
  for (const other of others) {
    const before = deps.parseJsonStringArray(other.relatedIds);
    const related = before.filter((id) => id !== tag.id);
    if (related.length !== before.length) {
      await db.noteTag.update({
        where: { id: other.id },
        data: { relatedIds: JSON.stringify(related) },
      });
    }
  }
  const notes = await db.note.findMany({ where: { userId } });
  for (const note of notes) {
    const before = deps.parseJsonStringArray(note.tagIds);
    const tagIds = before.filter((id) => id !== tag.id);
    if (tagIds.length !== before.length) {
      await db.note.update({
        where: { id: note.id },
        data: { tagIds: JSON.stringify(tagIds) },
      });
    }
  }
  await db.noteTag.delete({ where: { id: tag.id } });
  return { ok: true };
}
