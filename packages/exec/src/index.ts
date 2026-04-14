import type { HistoryEntry, RenamePlan } from "@namera/core";

export function createExecutionRecord(plan: RenamePlan): HistoryEntry {
  return {
    sourceName: plan.sourceName,
    proposedPath: plan.proposedPath,
    confidence: plan.confidence,
    createdAt: new Date().toISOString(),
  };
}

export function exportPlanSet(plans: RenamePlan[]): string {
  return JSON.stringify(plans, null, 2);
}
