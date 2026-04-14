import type { ExecutionAction, HistoryEntry, RenamePlan } from "@namera/core";

export function createExecutionRecord(plan: RenamePlan): HistoryEntry {
  return {
    sourceName: plan.sourceName,
    proposedPath: plan.proposedPath,
    confidence: plan.confidence,
    createdAt: new Date().toISOString(),
  };
}

export function createPlannedExecution(plan: RenamePlan): ExecutionAction {
  return {
    type: "rename",
    fromPath: plan.sourceName,
    toPath: plan.proposedPath,
    status: "planned",
    note: "Execution scaffold only. Real filesystem apply/undo still pending.",
  };
}

export function exportPlanSet(plans: RenamePlan[]): string {
  return JSON.stringify(plans, null, 2);
}
