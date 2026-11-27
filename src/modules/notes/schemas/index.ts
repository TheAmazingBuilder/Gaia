import { z } from "zod";
import { gaiaBlocksInputSchema } from "@/lib/gaia/content";

// Public schema retained for consumers that validate custom note properties.
export const gaiaNotePropertySchema = z.object({
  key: z.string().min(1).max(40),
  value: z.string().max(500),
  type: z.enum(["text", "number", "date", "checkbox", "select"]),
  options: z.array(z.string().max(80)).max(24).optional(),
});

const gaiaPropertiesInputSchema = z.array(gaiaNotePropertySchema).max(24);

export const noteCreateInputSchema = z.object({
  title: z.string().max(200).optional(),
  folderId: z.string().nullable().optional(),
  templateId: z.string().optional(),
  blocks: gaiaBlocksInputSchema.optional(),
  cover: z.string().max(2_000_000).nullable().optional(),
  wordGoal: z.number().int().min(0).max(1_000_000).nullable().optional(),
  properties: gaiaPropertiesInputSchema.optional(),
});

export const noteUpdateInputSchema = z.object({
  title: z.string().max(200).optional(),
  icon: z.string().max(16).nullable().optional(),
  folderId: z.string().nullable().optional(),
  tagIds: z.array(z.string()).max(24).optional(),
  favorite: z.boolean().optional(),
  blocks: gaiaBlocksInputSchema.optional(),
  cover: z.string().max(2_000_000).nullable().optional(),
  wordGoal: z.number().int().min(0).max(1_000_000).nullable().optional(),
  properties: gaiaPropertiesInputSchema.optional(),
  touchViewed: z.boolean().optional(),
});

export const writingSettingsInputSchema = z.object({
  dailyWordGoal: z.number().int().min(0).max(1_000_000),
});

export const noteDuplicateInputSchema = z.object({
  title: z.string().max(200).optional(),
});
