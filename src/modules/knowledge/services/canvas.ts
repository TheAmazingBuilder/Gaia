import {
  createKnowledgeCanvas,
  deleteKnowledgeCanvas,
  findActiveKnowledgeCanvasNoteIds,
  findUserKnowledgeCanvas,
  listUserKnowledgeCanvases,
  updateKnowledgeCanvas,
} from "@/modules/knowledge/repositories/canvas";
import {
  canvasInputSchema,
  canvasItemSchema,
} from "@/modules/knowledge/schemas";
import type { GaiaCanvasDTO, GaiaCanvasItemDTO } from "@/modules/knowledge/types";
import type { KnowledgeCanvas } from "@prisma/client";
import { parseOrThrow } from "@/shared/validation/parse-or-throw";

type CanvasDependencies = {
  validationError: (
    message: string,
    issues?: { path: string; message: string }[],
  ) => Error;
  canvasNotFound: () => Error;
};

function safeJsonParse(raw: string | null | undefined): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function canvasToDTO(row: KnowledgeCanvas): GaiaCanvasDTO {
  const parsed = safeJsonParse(row.items);
  const items: GaiaCanvasItemDTO[] = [];
  if (Array.isArray(parsed)) {
    for (const item of parsed) {
      const checked = canvasItemSchema.safeParse(item);
      if (checked.success) items.push(checked.data);
    }
  }
  return {
    id: row.id,
    name: row.name,
    items,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listCanvasesQuery(
  userId: string,
): Promise<{ canvases: GaiaCanvasDTO[] }> {
  const rows = await listUserKnowledgeCanvases(userId);
  return { canvases: rows.map(canvasToDTO) };
}

export async function getCanvasQuery(
  userId: string,
  canvasId: string,
  deps: Pick<CanvasDependencies, "canvasNotFound">,
): Promise<{ canvas: GaiaCanvasDTO }> {
  const row = await findUserKnowledgeCanvas(userId, canvasId);
  if (!row) throw deps.canvasNotFound();
  return { canvas: canvasToDTO(row) };
}

export async function createCanvasCommand(
  userId: string,
  input: unknown,
  deps: CanvasDependencies,
): Promise<{ canvas: GaiaCanvasDTO }> {
  const parsed = parseOrThrow(canvasInputSchema, input, deps.validationError);
  const row = await createKnowledgeCanvas(
    userId,
    parsed.name.trim(),
    JSON.stringify(parsed.items ?? []),
  );
  return { canvas: canvasToDTO(row) };
}

export async function updateCanvasCommand(
  userId: string,
  canvasId: string,
  input: unknown,
  deps: CanvasDependencies,
): Promise<{ canvas: GaiaCanvasDTO }> {
  const parsed = parseOrThrow(canvasInputSchema, input, deps.validationError);
  const row = await findUserKnowledgeCanvas(userId, canvasId);
  if (!row) throw deps.canvasNotFound();

  // Les cartes ne peuvent référencer que des notes existantes et actives.
  let items = parsed.items;
  if (items !== undefined) {
    const ids = [...new Set(items.map((item) => item.noteId))];
    const existing = await findActiveKnowledgeCanvasNoteIds(userId, ids);
    const known = new Set(existing.map((note) => note.id));
    items = items.filter((item) => known.has(item.noteId));
  }

  const updated = await updateKnowledgeCanvas(
    row.id,
    parsed.name.trim(),
    items !== undefined ? JSON.stringify(items) : undefined,
  );
  return { canvas: canvasToDTO(updated) };
}

export async function deleteCanvasCommand(
  userId: string,
  canvasId: string,
  deps: Pick<CanvasDependencies, "canvasNotFound">,
): Promise<{ ok: true }> {
  const row = await findUserKnowledgeCanvas(userId, canvasId);
  if (!row) throw deps.canvasNotFound();
  await deleteKnowledgeCanvas(row.id);
  return { ok: true };
}
