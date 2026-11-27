import { z } from "zod";

export const noteRelationInputSchema = z.object({
  toNoteId: z.string().min(1),
  type: z.string().min(1).max(60),
});
