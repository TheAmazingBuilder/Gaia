import { db } from "@/lib/db";
import { noteRelationInputSchema } from "@/modules/knowledge/schemas";
import { loadActiveNoteTitles } from "@/modules/knowledge/repositories/relations";
import type { GaiaNoteRelationDTO } from "@/modules/knowledge/types";
import type { Note, NoteRelation } from "@prisma/client";
import type { z } from "zod";

type SafeParser<T> = {
  safeParse: (
    input: unknown,
  ) =>
    | { success: true; data: T }
    | { success: false; error: z.ZodError };
};

type RelationDependencies = {
  validationError: (message: string, issues?: { path: string; message: string }[]) => Error;
  noteNotFound: () => Error;
  conflictError: (code: string, message: string) => Error;
  relationNotFound: () => Error;
};

function parseOrThrow<T>(
  schema: SafeParser<T>,
  input: unknown,
  validationError: RelationDependencies["validationError"],
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

async function findActiveNote(userId: string, noteId: string): Promise<Note | null> {
  return db.note.findFirst({ where: { userId, id: noteId, deletedAt: null } });
}

function relationToDTO(
  relation: NoteRelation,
  direction: "outgoing" | "incoming",
  otherTitle: string,
): GaiaNoteRelationDTO {
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

export async function listNoteRelationsQuery(
  userId: string,
  noteId: string,
  deps: Pick<RelationDependencies, "noteNotFound">,
): Promise<{ relations: GaiaNoteRelationDTO[] }> {
  const note = await findActiveNote(userId, noteId);
  if (!note) throw deps.noteNotFound();

  const relations = await db.noteRelation.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
  const mine = relations.filter(
    (relation) => relation.fromNoteId === noteId || relation.toNoteId === noteId,
  );
  const otherIds = mine.map((relation) =>
    relation.fromNoteId === noteId ? relation.toNoteId : relation.fromNoteId,
  );
  const titles = await loadActiveNoteTitles(userId, otherIds);

  return {
    relations: mine.map((relation) =>
      relationToDTO(
        relation,
        relation.fromNoteId === noteId ? "outgoing" : "incoming",
        titles.get(relation.fromNoteId === noteId ? relation.toNoteId : relation.fromNoteId) ??
          "Untitled note",
      ),
    ),
  };
}

export async function createNoteRelationCommand(
  userId: string,
  noteId: string,
  input: unknown,
  deps: Pick<RelationDependencies, "validationError" | "noteNotFound" | "conflictError">,
): Promise<{ relation: GaiaNoteRelationDTO }> {
  const parsed = parseOrThrow(noteRelationInputSchema, input, deps.validationError);
  const from = await findActiveNote(userId, noteId);
  if (!from) throw deps.noteNotFound();
  const to = await findActiveNote(userId, parsed.toNoteId);
  if (!to) throw deps.noteNotFound();
  if (parsed.toNoteId === noteId) {
    throw deps.validationError("A note cannot relate to itself.");
  }

  const type = parsed.type.trim();
  const existing = await db.noteRelation.findFirst({
    where: { userId, fromNoteId: noteId, toNoteId: parsed.toNoteId, type },
  });
  if (existing) {
    throw deps.conflictError("RELATION_EXISTS", "This relation already exists.");
  }

  const relation = await db.noteRelation.create({
    data: { userId, fromNoteId: noteId, toNoteId: parsed.toNoteId, type },
  });
  return {
    relation: relationToDTO(
      relation,
      "outgoing",
      to.title === "" ? "Untitled note" : to.title,
    ),
  };
}

export async function deleteNoteRelationCommand(
  userId: string,
  noteId: string,
  relationId: string,
  deps: Pick<RelationDependencies, "relationNotFound">,
): Promise<{ ok: true }> {
  const relation = await db.noteRelation.findFirst({
    where: { userId, id: relationId },
  });
  if (!relation || (relation.fromNoteId !== noteId && relation.toNoteId !== noteId)) {
    throw deps.relationNotFound();
  }
  await db.noteRelation.delete({ where: { id: relation.id } });
  return { ok: true };
}
