import type { ExecutionAction, ExecutionBatch, HistoryEntry, RenamePlan } from "@namera/core";

export function createExecutionRecord(plan: RenamePlan): HistoryEntry {
  return {
    sourceName: plan.sourceName,
    proposedPath: plan.proposedPath,
    confidence: plan.confidence,
    createdAt: new Date().toISOString(),
  };
}

export function createPlannedExecutions(plan: RenamePlan): ExecutionAction[] {
  const actions: ExecutionAction[] = [];
  const segments = plan.proposedPath.split("/");

  if (segments.length > 1) {
    const directoryPath = segments.slice(0, -1).join("/");
    actions.push({
      type: "mkdir",
      toPath: directoryPath,
      status: "planned",
      note: "Ensure target directory exists before rename/move",
    });
  }

  actions.push({
    type: "rename",
    fromPath: plan.sourceName,
    toPath: plan.proposedPath,
    status: "planned",
    note: "Execution scaffold only. Real filesystem apply/undo still pending.",
  });

  return actions;
}

export function createExecutionBatch(plan: RenamePlan, mode: ExecutionBatch["mode"] = "dry-run"): ExecutionBatch {
  const actions = createPlannedExecutions(plan).map((action) => ({
    ...action,
    status: mode === "undo" ? "reverted" : "planned",
    note:
      mode === "dry-run"
        ? "Dry-run only. No filesystem changes executed."
        : mode === "apply"
          ? "Apply contract ready for Tauri/native filesystem implementation."
          : "Undo contract ready once execution logs exist.",
  }));

  return {
    mode,
    actions,
    summary: summarizeExecutionBatch(mode, actions),
  };
}

export function summarizeExecutionActions(actions: ExecutionAction[]): string {
  if (!actions.length) return "No execution actions planned";
  return actions.map((action) => `${action.type}:${action.toPath}`).join(" | ");
}

export function summarizeExecutionBatch(mode: ExecutionBatch["mode"], actions: ExecutionAction[]): string {
  const verb = mode === "dry-run" ? "Would run" : mode === "apply" ? "Ready to apply" : "Would undo";
  return `${verb} ${actions.length} action${actions.length === 1 ? "" : "s"}`;
}

export function exportPlanSet(plans: RenamePlan[]): string {
  return JSON.stringify(plans, null, 2);
}
