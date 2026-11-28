import { getOverviewQuery } from "@/modules/knowledge/services/overview";

type OverviewDependencies = Parameters<typeof getOverviewQuery>[1];

export function getOverview(
  userId: string,
  deps: OverviewDependencies,
) {
  return getOverviewQuery(userId, deps);
}
