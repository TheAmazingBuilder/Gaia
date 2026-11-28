import { listRefs, type GaiaRefHit } from "@/lib/gaia/refs";

export type { GaiaRefHit };

/** Server-facing adapter for the entity-reference picker. */
export async function listGaiaRefs(
  userId: string,
  query: string,
  kind?: string,
): Promise<{ refs: GaiaRefHit[] }> {
  const refs = await listRefs(userId, query, kind);
  return { refs };
}
