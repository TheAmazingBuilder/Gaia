/**
 * Contrat interne partagé des métadonnées de notes.
 *
 * Ce type décrit les données exposées par le module Notes sans dépendre
 * des types générés par Prisma ni de sa projection de requête.
 */
export type NoteListRow = {
  id: string;
  title: string;
  icon: string | null;
  folderId: string | null;
  tagIds: string;
  favorite: boolean;
  templateId: string | null;
  cover: string | null;
  wordGoal: number | null;
  properties: string;
  createdAt: Date;
  updatedAt: Date;
  lastViewedAt: Date | null;
  deletedAt: Date | null;
  mastery: string;
  lastReviewedAt: Date | null;
  nextReviewAt: Date | null;
  reviewCount: number;
  easeFactor: number;
  intervalDays: number;
};

export type NoteRowInput = NoteListRow & {
  blocks: string;
};

/** Minimal folder metadata consumed by Notes and Knowledge DTO mappers. */
export type NoteFolderMappingRecord = {
  id: string;
  userId: string;
  name: string;
  parentId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

/** Minimal tag metadata consumed by Notes and Knowledge DTO mappers. */
export type NoteTagMappingRecord = {
  id: string;
  userId: string;
  name: string;
  parentId: string | null;
  relatedIds: string;
  createdAt: Date;
  updatedAt: Date;
};
