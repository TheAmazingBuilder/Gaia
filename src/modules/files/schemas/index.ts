import { z } from "zod";

const fileUpdateInputSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  folderId: z.string().min(1).max(64).nullable().optional(),
});

const fileTextInputSchema = z.object({
  text: z.string().max(200_000),
  source: z.enum(["pdf", "ocr"]).optional(),
});

const fileAnnotationInputSchema = z.object({
  page: z.number().int().min(1).max(10_000),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().min(0).max(1).nullable().optional(),
  height: z.number().min(0).max(1).nullable().optional(),
  type: z.enum(["note", "highlight"]).default("note"),
  text: z.string().max(2_000).default(""),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#FF6B5B"),
});
