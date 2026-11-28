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
