import { db } from "@/lib/db";
import {
  templateCreateInputSchema,
  templateInstantiateInputSchema,
} from "@/modules/notes/schemas";
import type { GaiaBlock, GaiaBlockInput } from "@/lib/gaia/content";
import type { Note } from "@prisma/client";
import type { GaiaNoteResponse, GaiaTemplateDTO } from "@/modules/notes/types";
import { builtInTemplates, findBuiltInTemplate } from "@/lib/gaia/templates";
import { parseOrThrow } from "@/shared/validation/parse-or-throw";


type TemplateDependencies = {
  validationError: (message: string, issues?: { path: string; message: string }[]) => Error;
  noteNotFound: () => Error;
  templateNotFound: () => Error;
  parseBlocks: (input: GaiaBlockInput[]) => GaiaBlock[];
  parseStoredBlocks: (stored: string | null | undefined) => GaiaBlock[];
  cloneBlocksWithNewIds: (blocks: GaiaBlock[]) => GaiaBlock[];
  emptyParagraphBlock: () => GaiaBlock;
  assertSafeImageSources: (blocks: GaiaBlock[]) => void;
  findActiveNote: (userId: string, noteId: string) => Promise<Note | null>;
  createNote: (userId: string, input: unknown) => Promise<GaiaNoteResponse>;
};


function stripRefs(blocks: GaiaBlock[]): GaiaBlock[] {
  return blocks.map((block) => {
    const { ref: _ref, ...rest } = block;
    const next: GaiaBlock = rest;
    if (block.children) next.children = stripRefs(block.children);
    if (block.columns) {
      next.columns = block.columns.map((column) => stripRefs(column));
    }
    return next;
  });
}

function userTemplateToDTO(
  template: {
    id: string;
    name: string;
    description: string;
    icon: string;
    blocks: string;
    builtIn: boolean;
    createdAt: Date;
  },
  parseStoredBlocks: TemplateDependencies["parseStoredBlocks"],
): GaiaTemplateDTO {
  return {
    id: template.id,
    name: template.name,
    description: template.description,
    icon: template.icon,
    blocks: parseStoredBlocks(template.blocks),
    builtIn: template.builtIn,
    createdAt: template.createdAt.toISOString(),
  };
}

function builtInToDTO(template: ReturnType<typeof builtInTemplates>[number]): GaiaTemplateDTO {
  return {
    id: template.id,
    name: template.name,
    description: template.description,
    icon: template.icon,
    blocks: template.blocks,
    builtIn: true,
    createdAt: template.createdAt,
  };
}

/** Resolve built-in templates first, then templates owned by the requesting user. */
export async function findTemplateQuery(
  userId: string,
  templateId: string,
  parseStoredBlocks: TemplateDependencies["parseStoredBlocks"],
): Promise<GaiaTemplateDTO | null> {
  const builtIn = findBuiltInTemplate(templateId);
  if (builtIn) return builtInToDTO(builtIn);

  const row = await db.noteTemplate.findFirst({ where: { userId, id: templateId } });
  return row ? userTemplateToDTO(row, parseStoredBlocks) : null;
}

export async function listTemplatesQuery(
  userId: string,
  parseStoredBlocks: TemplateDependencies["parseStoredBlocks"],
): Promise<{ templates: GaiaTemplateDTO[] }> {
  const userTemplates = await db.noteTemplate.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
  return {
    templates: [
      ...builtInTemplates().map(builtInToDTO),
      ...userTemplates.map((template) => userTemplateToDTO(template, parseStoredBlocks)),
    ],
  };
}

export async function createTemplateCommand(
  userId: string,
  input: unknown,
  deps: TemplateDependencies,
): Promise<GaiaTemplateDTO> {
  const parsed = parseOrThrow(templateCreateInputSchema, input, deps.validationError);
  let blocks: GaiaBlock[];

  if (parsed.blocks !== undefined) {
    blocks = deps.parseBlocks(parsed.blocks);
  } else if (parsed.fromNoteId !== undefined) {
    const note = await deps.findActiveNote(userId, parsed.fromNoteId);
    if (!note) throw deps.noteNotFound();
    blocks = stripRefs(
      deps.cloneBlocksWithNewIds(deps.parseStoredBlocks(note.blocks)),
    );
  } else {
    blocks = [deps.emptyParagraphBlock()];
  }

  deps.assertSafeImageSources(blocks);
  const template = await db.noteTemplate.create({
    data: {
      userId,
      name: parsed.name.trim(),
      description: parsed.description.trim(),
      icon: parsed.icon || "📄",
      blocks: JSON.stringify(blocks),
      builtIn: false,
    },
  });
  return userTemplateToDTO(template, deps.parseStoredBlocks);
}

export async function instantiateTemplateCommand(
  userId: string,
  input: unknown,
  deps: TemplateDependencies,
): Promise<GaiaNoteResponse> {
  const parsed = parseOrThrow(templateInstantiateInputSchema, input, deps.validationError);
  const template = await findTemplateQuery(userId, parsed.templateId, deps.parseStoredBlocks);
  if (!template) throw deps.templateNotFound();

  return deps.createNote(userId, {
    title: parsed.title?.trim() || template.name,
    folderId: parsed.folderId ?? null,
    templateId: template.id,
  });
}
