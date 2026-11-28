import {
  createUserPeriodicNoteFolder,
  findUserPeriodicNote,
  findUserPeriodicNoteFolder,
  findUserTimezone,
  touchUserPeriodicNote,
} from "@/modules/knowledge/repositories/periodic-notes";
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
  const existing = await findUserPeriodicNoteFolder(userId, name);
  if (existing) return existing;
  return createUserPeriodicNoteFolder(userId, name);
}

export async function getOrCreateDailyNoteCommand(
  userId: string,
  deps: PeriodicNotesDependencies,
): Promise<GaiaNoteResponse> {
  const user = await findUserTimezone(userId);
  const tz = user?.timezone ?? "UTC";
  const now = new Date();
  const title = dailyNoteTitle(now, tz);
  const folder = await findOrCreateFolder(userId, "Daily Notes");
  const existing = await findUserPeriodicNote(userId, folder.id, title);
  if (existing) {
    const touched = await touchUserPeriodicNote(existing.id, new Date());
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
  const user = await findUserTimezone(userId);
  const tz = user?.timezone ?? "UTC";
  const now = new Date();
  const title = weeklyNoteTitle(now);
  const folder = await findOrCreateFolder(userId, "Weekly Notes");
  const existing = await findUserPeriodicNote(userId, folder.id, title);
  if (existing) {
    const touched = await touchUserPeriodicNote(existing.id, new Date());
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
