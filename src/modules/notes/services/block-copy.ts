import {
  newBlockId,
  newSyncId,
  type GaiaBlock,
} from "@/lib/gaia/content";

/**
 * Deep-clone a note's block tree with fresh block IDs.
 * Synced blocks within the clone keep their internal grouping, but are
 * disconnected from the source note's sync groups.
 */
export function cloneBlocksWithNewIds(blocks: GaiaBlock[]): GaiaBlock[] {
  const syncMap = new Map<string, string>();
  const cloneOne = (block: GaiaBlock): GaiaBlock => {
    const next: GaiaBlock = { ...block, id: newBlockId() };
    if (block.type === "synced" && block.syncId) {
      let fresh = syncMap.get(block.syncId);
      if (!fresh) {
        fresh = newSyncId();
        syncMap.set(block.syncId, fresh);
      }
      next.syncId = fresh;
    }
    if (block.children) next.children = block.children.map(cloneOne);
    if (block.columns) next.columns = block.columns.map((col) => col.map(cloneOne));
    return next;
  };
  return blocks.map(cloneOne);
}
