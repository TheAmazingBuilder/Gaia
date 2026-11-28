import { z } from "zod";

export const noteRelationInputSchema = z.object({
  toNoteId: z.string().min(1),
  type: z.string().min(1).max(60),
});

export const gaiaCollectionCriteriaSchema = z.object({
  folderId: z.string().nullable().optional(),
  tagIds: z.array(z.string()).max(24).optional(),
  mastery: z.string().max(20).optional(),
  favorite: z.boolean().optional(),
  q: z.string().max(200).optional(),
  properties: z
    .array(z.object({ key: z.string().min(1).max(40), value: z.string().max(500) }))
    .max(12)
    .optional(),
});

export const collectionInputSchema = z.object({
  name: z.string().min(1).max(120),
  icon: z.string().max(16).optional(),
  criteria: gaiaCollectionCriteriaSchema.optional(),
});

export const canvasItemSchema = z.object({
  noteId: z.string().min(1),
  x: z.number().min(-100).max(5000),
  y: z.number().min(-100).max(5000),
  w: z.number().min(120).max(1200).optional(),
  h: z.number().min(80).max(1200).optional(),
});

export const canvasInputSchema = z.object({
  name: z.string().min(1).max(120),
  items: z.array(canvasItemSchema).max(200).optional(),
});

export const inboxInputSchema = z.object({
  text: z.string().min(1).max(2000),
});
