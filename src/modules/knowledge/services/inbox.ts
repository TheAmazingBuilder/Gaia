import { db } from "@/lib/db";
import { newBlockId, type GaiaBlock } from "@/lib/gaia/content";
import { inboxInputSchema } from "@/modules/knowledge/schemas";
import type { GaiaInboxItemDTO } from "@/modules/knowledge/types";
import type { GaiaNoteDTO, GaiaNoteResponse } from "@/modules/notes/types";
import type { InboxItem, Note, NoteFolder, NoteTag } from "@prisma/client";

type InboxDependencies = {
  validationError: (
    message: string,
    issues?: { path: string; message: string }[],
  ) => Error;
  inboxItemNotFound: () => Error;
  findActiveNote: (userId: string, noteId: string) => Promise<Note | null>;
  loadFolders: (userId: string) => Promise<NoteFolder[]>;
  loadTags: (userId: string) => Promise<NoteTag[]>;
  toDTO: (note: Note) => GaiaNoteDTO;
  createNote: (userId: string, input: unknown) => Promise<GaiaNoteResponse>;
};

function inboxToDTO(row: InboxItem): GaiaInboxItemDTO {
  return {
    id: row.id,
    text: row.text,
    doneAt: row.doneAt?.toISOString() ?? null,
    noteId: row.noteId,
    createdAt: row.createdAt.toISOString(),
  };
}

function parseInboxInput(
  input: unknown,
  validationError: InboxDependencies["validationError"],
): { text: string } {
  const parsed = inboxInputSchema.safeParse(input);
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

export async function listInboxQuery(
  userId: string,
): Promise<{ open: GaiaInboxItemDTO[]; done: GaiaInboxItemDTO[] }> {
  const rows = await db.inboxItem.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return {
    open: rows.filter((row) => row.doneAt === null).map(inboxToDTO),
    done: rows.filter((row) => row.doneAt !== null).map(inboxToDTO),
  };
}

export async function createInboxItemCommand(
  userId: string,
  input: unknown,
  deps: Pick<InboxDependencies, "validationError">,
): Promise<{ item: GaiaInboxItemDTO }> {
  const parsed = parseInboxInput(input, deps.validationError);
  const row = await db.inboxItem.create({
    data: { userId, text: parsed.text.trim() },
  });
  return { item: inboxToDTO(row) };
}

export async function toggleInboxItemCommand(
  userId: string,
  itemId: string,
  done: boolean,
  deps: Pick<InboxDependencies, "inboxItemNotFound">,
): Promise<{ item: GaiaInboxItemDTO }> {
  const row = await db.inboxItem.findFirst({ where: { userId, id: itemId } });
  if (!row) throw deps.inboxItemNotFound();
  const updated = await db.inboxItem.update({
    where: { id: row.id },
    data: { doneAt: done ? new Date() : null },
  });
  return { item: inboxToDTO(updated) };
}

export async function deleteInboxItemCommand(
  userId: string,
  itemId: string,
  deps: Pick<InboxDependencies, "inboxItemNotFound">,
): Promise<{ ok: true }> {
  const row = await db.inboxItem.findFirst({ where: { userId, id: itemId } });
  if (!row) throw deps.inboxItemNotFound();
  await db.inboxItem.delete({ where: { id: row.id } });
  return { ok: true };
}

export async function convertInboxItemCommand(
  userId: string,
  itemId: string,
  deps: InboxDependencies,
): Promise<{ note: GaiaNoteResponse["note"]; item: GaiaInboxItemDTO }> {
  const row = await db.inboxItem.findFirst({ where: { userId, id: itemId } });
  if (!row) throw deps.inboxItemNotFound();

  if (row.noteId) {
    const note = await deps.findActiveNote(userId, row.noteId);
    if (note) {
      await Promise.all([deps.loadFolders(userId), deps.loadTags(userId)]);
      return { note: deps.toDTO(note), item: inboxToDTO(row) };
    }
  }

  const lines = row.text.split("\n").map((line) => line.trim()).filter((line) => line !== "");
  const title = (lines[0] ?? "").slice(0, 200);
  const blocks: GaiaBlock[] = lines.slice(0, 50).map((line) => ({
    id: newBlockId(),
    type: "paragraph",
    text: line,
  }));
  if (blocks.length === 0) {
    blocks.push({ id: newBlockId(), type: "paragraph", text: "" });
  }

  const created = await deps.createNote(userId, { title, blocks });
  const updated = await db.inboxItem.update({
    where: { id: row.id },
    data: { noteId: created.note.id, doneAt: new Date() },
  });
  return { note: created.note, item: inboxToDTO(updated) };
}
