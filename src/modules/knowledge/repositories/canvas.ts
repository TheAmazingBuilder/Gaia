import { db } from "@/shared/database/client";

/** Persistence queries and commands for Knowledge canvases. */
export function listUserKnowledgeCanvases(userId: string) {
  return db.knowledgeCanvas.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
  });
}

export function findUserKnowledgeCanvas(userId: string, canvasId: string) {
  return db.knowledgeCanvas.findFirst({
    where: { userId, id: canvasId },
  });
}

export function createKnowledgeCanvas(
  userId: string,
  name: string,
  items: string,
) {
  return db.knowledgeCanvas.create({
    data: { userId, name, items },
  });
}

export function findActiveKnowledgeCanvasNoteIds(userId: string, ids: string[]) {
  return db.note.findMany({
    where: { userId, id: { in: ids }, deletedAt: null },
    select: { id: true },
  });
}

export function updateKnowledgeCanvas(
  canvasId: string,
  name: string,
  items?: string,
) {
  return db.knowledgeCanvas.update({
    where: { id: canvasId },
    data: {
      name,
      ...(items !== undefined ? { items } : {}),
    },
  });
}

export function deleteKnowledgeCanvas(canvasId: string) {
  return db.knowledgeCanvas.delete({ where: { id: canvasId } });
}
