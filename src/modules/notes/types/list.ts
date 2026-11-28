import type { Prisma } from "@prisma/client";

/**
 * Projection publique des métadonnées de notes consommées par les autres modules.
 * Garder cette sélection alignée sur les données réellement nécessaires aux vues.
 */
export const NOTE_LIST_SELECT = {
  id: true,
  title: true,
  icon: true,
  folderId: true,
  tagIds: true,
  favorite: true,
  templateId: true,
  cover: true,
  wordGoal: true,
  properties: true,
  createdAt: true,
  updatedAt: true,
  lastViewedAt: true,
  deletedAt: true,
  mastery: true,
  lastReviewedAt: true,
  nextReviewAt: true,
  reviewCount: true,
  easeFactor: true,
  intervalDays: true,
} as const;

export type NoteListRow = Prisma.NoteGetPayload<{ select: typeof NOTE_LIST_SELECT }>;
export type NoteRowInput = NoteListRow & { blocks: string };
