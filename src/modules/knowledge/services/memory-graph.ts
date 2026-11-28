import { loadMemoryGraphNotes, loadMemoryGraphRelations } from "@/modules/knowledge/repositories/memory-graph";
import {
  flattenBlocks,
  parseJsonBlocks,
  parseJsonStringArray,
} from "@/lib/gaia/content";
import { isMasteryLevel } from "@/lib/gaia/spaced-repetition";
import type {
  GaiaMemoryGraphEdge,
  GaiaMemoryGraphNode,
  GaiaMemoryGraphResponse,
} from "@/modules/knowledge/types";

const MAX_TAG_EDGES = 200;
const MAX_TAG_GROUP_SIZE = 8;

type MemoryGraphDependencies = {
  loadTags: (userId: string) => Promise<Array<{ id: string; name: string }>>;
};

export async function getMemoryGraphQuery(
  userId: string,
  deps: MemoryGraphDependencies,
): Promise<GaiaMemoryGraphResponse> {
  const notes = await loadMemoryGraphNotes(userId);
  const ids = new Set(notes.map((note) => note.id));
  const nodes: GaiaMemoryGraphNode[] = notes.map((note) => ({
    id: note.id,
    title: note.title,
    mastery: isMasteryLevel(note.mastery) ? note.mastery : "fragile",
    folderId: note.folderId,
    orphan: true,
  }));

  const edges: GaiaMemoryGraphEdge[] = [];
  const seenRef = new Set<string>();
  for (const note of notes) {
    for (const block of flattenBlocks(parseJsonBlocks(note.blocks))) {
      if (block.type !== "ref" || block.ref?.kind !== "NOTE") continue;
      const target = block.ref.id;
      if (target === note.id || !ids.has(target)) continue;
      const key = `${note.id}→${target}`;
      if (seenRef.has(key)) continue;
      seenRef.add(key);
      edges.push({ from: note.id, to: target, kind: "ref" });
    }
  }

  const tags = await deps.loadTags(userId);
  const tagNameOf = new Map(tags.map((tag) => [tag.id, tag.name]));
  const byTag = new Map<string, string[]>();
  for (const note of notes) {
    for (const tagId of parseJsonStringArray(note.tagIds)) {
      const list = byTag.get(tagId) ?? [];
      list.push(note.id);
      byTag.set(tagId, list);
    }
  }

  let tagEdges = 0;
  for (const [tagId, members] of [...byTag.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  )) {
    if (members.length < 2 || members.length > MAX_TAG_GROUP_SIZE) continue;
    for (let i = 0; i < members.length && tagEdges < MAX_TAG_EDGES; i++) {
      for (let j = i + 1; j < members.length && tagEdges < MAX_TAG_EDGES; j++) {
        edges.push({
          from: members[i],
          to: members[j],
          kind: "tag",
          tagName: tagNameOf.get(tagId) ?? tagId,
        });
        tagEdges += 1;
      }
    }
    if (tagEdges >= MAX_TAG_EDGES) break;
  }

  const relations = await loadMemoryGraphRelations(userId);
  const relationTypes = [...new Set(relations.map((relation) => relation.type))].sort();
  for (const relation of relations) {
    if (!ids.has(relation.fromNoteId) || !ids.has(relation.toNoteId)) continue;
    edges.push({
      from: relation.fromNoteId,
      to: relation.toNoteId,
      kind: "relation",
      label: relation.type,
    });
  }

  const touched = new Set<string>();
  for (const edge of edges) {
    touched.add(edge.from);
    touched.add(edge.to);
  }
  for (const node of nodes) node.orphan = !touched.has(node.id);

  return { nodes, edges, relationTypes };
}
