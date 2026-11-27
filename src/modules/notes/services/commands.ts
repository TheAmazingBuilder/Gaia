import { db } from "@/lib/db";
import {
  noteCreateInputSchema,
  noteDuplicateInputSchema,
} from "@/modules/notes/schemas";
import type { GaiaNoteResponse, GaiaNoteProperty } from "@/modules/notes/types";
import type { GaiaBlock } from "@/lib/gaia/content";
import type { Note } from "@prisma/client";
import type { z } from "zod";

type NoteTemplate = { id: string; icon: string; blocks: GaiaBlock[] };

type NoteCommandDependencies = {
  validationError: (message: string, issues?: { path: string; message: string }[]) => Error;
  noteNotFound: () => Error;
  folderNotFound: () => Error;
  parseBlocks: (input: unknown) => GaiaBlock[];
  cloneBlocksWithNewIds: (blocks: GaiaBlock[]) => GaiaBlock[];
  emptyParagraphBlock: () => GaiaBlock;
  assertSafeImageSources: (blocks: GaiaBlock[]) => void;
  normalizeProperties: (properties: GaiaNoteProperty[]) => GaiaNoteProperty[];
  findTemplate: (userId: string, templateId: string) => Promise<NoteTemplate | null>;
  findActiveNote: (userId: string, noteId: string) => Promise<Note | null>;
  noteResponse: (userId: string, note: Note) => Promise<GaiaNoteResponse>;
};

function parseOrThrow<T>(
  schema: { safeParse: (input: unknown) => { success: true; data: T } | { success: false; error: z.ZodError } },
  input: unknown,
  validationError: NoteCommandDependencies["validationError"],
): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw validationError(
      "Some fields are invalid.",
      parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    );
  }
  return parsed.data;
}

/** Create a note while keeping template, folder and block rules at the module boundary. */
export async function createNoteCommand(
  userId: string,
  input: unknown,
  deps: NoteCommandDependencies,
): Promise<GaiaNoteResponse> {
  const parsed = parseOrThrow(noteCreateInputSchema, input, deps.validationError);

  const folderId = parsed.folderId ?? null;
  if (folderId !== null) {
    const folder = await db.noteFolder.findFirst({
      where: { userId, id: folderId },
      select: { id: true },
    });
    if (!folder) throw deps.folderNotFound();
  }

  const template = parsed.templateId !== undefined
    ? await deps.findTemplate(userId, parsed.templateId)
    : null;

  let blocks: GaiaBlock[];
  if (parsed.blocks !== undefined) {
    blocks = deps.parseBlocks(parsed.blocks);
  } else if (template) {
    blocks = deps.cloneBlocksWithNewIds(template.blocks);
  } else {
    blocks = [deps.emptyParagraphBlock()];
  }
  deps.assertSafeImageSources(blocks);

  const now = new Date();
  const note = await db.note.create({
    data: {
      userId,
      title: parsed.title?.trim() ?? "",
      icon: template?.icon ?? "📝",
      folderId,
      tagIds: "[]",
      favorite: false,
      templateId: template?.id ?? null,
      blocks: JSON.stringify(blocks),
      cover: parsed.cover ?? null,
      wordGoal: parsed.wordGoal ?? null,
      properties: parsed.properties
        ? JSON.stringify(deps.normalizeProperties(parsed.properties))
        : "[]",
      createdAt: now,
      updatedAt: now,
      lastViewedAt: now,
      deletedAt: null,
      mastery: "fragile",
      lastReviewedAt: null,
      nextReviewAt: now,
      reviewCount: 0,
      easeFactor: 2.5,
      intervalDays: 0,
    },
  });
  return deps.noteResponse(userId, note);
}

/** Duplicate an active note with independent block and synced-block identifiers. */
export async function duplicateNoteCommand(
  userId: string,
  noteId: string,
  input: unknown,
  deps: NoteCommandDependencies,
): Promise<GaiaNoteResponse> {
  const parsed = parseOrThrow(noteDuplicateInputSchema, input ?? {}, deps.validationError);
  const source = await deps.findActiveNote(userId, noteId);
  if (!source) throw deps.noteNotFound();

  const title = parsed.title?.trim() ??
    (source.title === "" ? "Untitled note (copy)" : `${source.title} (copie)`);
  const now = new Date();
  const copy = await db.note.create({
    data: {
      userId,
      title,
      icon: source.icon,
      folderId: source.folderId,
      tagIds: source.tagIds,
      favorite: false,
      templateId: source.templateId,
      blocks: JSON.stringify(deps.cloneBlocksWithNewIds(deps.parseBlocks(source.blocks))),
      createdAt: now,
      updatedAt: now,
      lastViewedAt: now,
      deletedAt: null,
      mastery: "fragile",
      lastReviewedAt: null,
      nextReviewAt: now,
      reviewCount: 0,
      easeFactor: 2.5,
      intervalDays: 0,
    },
  });
  return deps.noteResponse(userId, copy);
}
