import { db } from "@/shared/database/client";
import { newBlockId, type GaiaBlock } from "@/lib/gaia/content";
import { dailyNoteTitle, weeklyNoteTitle, weekStart } from "@/lib/gaia/knowledge";
import type { GaiaNoteResponse } from "@/modules/notes/types";
import type { Note, NoteFolder, NoteTag } from "@prisma/client";

type PeriodicNotesDependencies = {
  loadFolders: (userId: string) => Promise<NoteFolder[]>;
  loadTags: (userId: string) => Promise<NoteTag[]>;
  noteResponse: (
    userId: string,
    note: Note,
    folders: NoteFolder[],
    tags: NoteTag[],
  ) => Promise<GaiaNoteResponse>;
  createNote: (userId: string, input: unknown) => Promise<GaiaNoteResponse>;
};

async function findOrCreateFolder(userId: string, name: string): Promise<NoteFolder> {
  const existing = await db.noteFolder.findFirst({ where: { userId, name } });
  if (existing) return existing;
  return db.noteFolder.create({ data: { userId, name, parentId: null } });
}

export async function getOrCreateDailyNoteCommand(
  userId: string,
  deps: PeriodicNotesDependencies,
): Promise<GaiaNoteResponse> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { timezone: true },
  });
  const tz = user?.timezone ?? "UTC";
  const now = new Date();
  const title = dailyNoteTitle(now, tz);
  const folder = await findOrCreateFolder(userId, "Daily Notes");
  const existing = await db.note.findFirst({
    where: { userId, folderId: folder.id, title, deletedAt: null },
  });
  if (existing) {
    const touched = await db.note.update({
      where: { id: existing.id },
      data: { lastViewedAt: new Date() },
    });
    const [folders, tags] = await Promise.all([deps.loadFolders(userId), deps.loadTags(userId)]);
    return deps.noteResponse(userId, touched, folders, tags);
  }

  const longDate = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(now);
  const blocks: GaiaBlock[] = [
    { id: newBlockId(), type: "h1", text: longDate },
    { id: newBlockId(), type: "h2", text: "Tasks" },
    { id: newBlockId(), type: "todo", text: "" },
    { id: newBlockId(), type: "h2", text: "Notes" },
    { id: newBlockId(), type: "paragraph", text: "" },
  ];
  return deps.createNote(userId, { title, folderId: folder.id, blocks });
}

export async function getOrCreateWeeklyNoteCommand(
  userId: string,
  deps: PeriodicNotesDependencies,
): Promise<GaiaNoteResponse> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { timezone: true },
  });
  const tz = user?.timezone ?? "UTC";
  const now = new Date();
  const title = weeklyNoteTitle(now);
  const folder = await findOrCreateFolder(userId, "Weekly Notes");
  const existing = await db.note.findFirst({
    where: { userId, folderId: folder.id, title, deletedAt: null },
  });
  if (existing) {
    const touched = await db.note.update({
      where: { id: existing.id },
      data: { lastViewedAt: new Date() },
    });
    const [folders, tags] = await Promise.all([deps.loadFolders(userId), deps.loadTags(userId)]);
    return deps.noteResponse(userId, touched, folders, tags);
  }

  const monday = weekStart(now);
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    month: "short",
    day: "numeric",
  });
  const range = `${fmt.format(monday)} – ${fmt.format(sunday)}, ${monday.getFullYear()}`;
  const blocks: GaiaBlock[] = [
    { id: newBlockId(), type: "h1", text: title },
    { id: newBlockId(), type: "paragraph", text: range },
    { id: newBlockId(), type: "h2", text: "Goals" },
    { id: newBlockId(), type: "todo", text: "" },
    { id: newBlockId(), type: "h2", text: "Review" },
    { id: newBlockId(), type: "paragraph", text: "" },
    { id: newBlockId(), type: "h2", text: "Notes" },
    { id: newBlockId(), type: "paragraph", text: "" },
  ];
  return deps.createNote(userId, { title, folderId: folder.id, blocks });
}
