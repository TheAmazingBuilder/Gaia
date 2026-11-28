import "server-only";

import {
  getKnowledgeTimelineQuery,
} from "@/modules/knowledge/services/timeline";
import { getMemoryGraphQuery } from "@/modules/knowledge/services/memory-graph";
import { getMemoryStatsQuery } from "@/modules/knowledge/services/memory-stats";
import type {
  GaiaKnowledgeTimelineMonth,
  GaiaMemoryGraphResponse,
  GaiaMemoryStatsResponse,
} from "@/modules/knowledge/types";
import { loadTags } from "@/modules/notes/repositories/notes";

export async function getMemoryGraph(
  userId: string,
): Promise<GaiaMemoryGraphResponse> {
  return getMemoryGraphQuery(userId, { loadTags });
}

export async function getMemoryStats(
  userId: string,
): Promise<GaiaMemoryStatsResponse> {
  return getMemoryStatsQuery(userId);
}

export async function getKnowledgeTimeline(
  userId: string,
): Promise<{ months: GaiaKnowledgeTimelineMonth[] }> {
  return getKnowledgeTimelineQuery(userId);
}
