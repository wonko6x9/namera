import { loadExecutionLog, markExecutionUndone, pushExecutionLog } from "@namera/config";
import { createPhase3DestinationPlan, createPhase3TransferPlan } from "@namera/destination";
import type { DestinationProfile, ExecutionAction, ExecutionBatch, ExecutionLogEntry, HistoryEntry, PreviewResult, RenamePlan, ReviewPlanExportItem, WebdavTransferQueueItem } from "@namera/core";

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
    status: mode === "undo" ? "reverted" : mode === "apply" ? "applied" : "planned",
    note:
      mode === "dry-run"
        ? "Dry-run only. No filesystem changes executed."
        : mode === "apply"
          ? "Apply contract recorded and ready for native filesystem implementation."
          : "Undo contract recorded against the most recent matching execution log.",
  }));

  const batch: ExecutionBatch = {
    mode,
    actions,
    summary: summarizeExecutionBatch(mode, actions),
  };

  if (mode === "apply") {
    batch.logEntry = persistExecutionLog(plan, actions, "apply");
  } else if (mode === "undo") {
    batch.logEntry = recordUndo(plan, actions);
  }

  return batch;
}

export function summarizeExecutionActions(actions: ExecutionAction[]): string {
  if (!actions.length) return "No execution actions planned";
  return actions.map((action) => `${action.type}:${action.toPath}`).join(" | ");
}

export function summarizeExecutionBatch(mode: ExecutionBatch["mode"], actions: ExecutionAction[]): string {
  const verb = mode === "dry-run" ? "Would run" : mode === "apply" ? "Recorded apply for" : "Recorded undo for";
  return `${verb} ${actions.length} action${actions.length === 1 ? "" : "s"}`;
}

export function exportPlanSet(plans: RenamePlan[]): string {
  return JSON.stringify(plans, null, 2);
}

export function exportReviewPlanSet(
  previews: PreviewResult[],
  config?: DestinationProfile,
  backend: "local" | "webdav" = "local",
): string {
  const exported: ReviewPlanExportItem[] = previews.map((preview) => ({
    input: preview.input,
    detectedKind: preview.parsed.kind,
    match: {
      provider: preview.candidate.provider,
      displayName: preview.candidate.displayName,
      confidenceLabel: preview.candidate.confidenceLabel,
      score: preview.candidate.score,
    },
    renamePlan: preview.plan,
    destinationPlan: createPhase3DestinationPlan(preview.plan, preview.parsed.kind, config, backend),
    transferPlan: backend === "webdav"
      ? createPhase3TransferPlan(preview.plan, preview.parsed.kind, config)
      : undefined,
  }));

  return JSON.stringify({ backend, items: exported }, null, 2);
}

export function buildWebdavTransferQueue(previews: PreviewResult[], config?: DestinationProfile): WebdavTransferQueueItem[] {
  return previews.map((preview) => {
    const destination = createPhase3DestinationPlan(preview.plan, preview.parsed.kind, config, "webdav");
    const transfer = createPhase3TransferPlan(preview.plan, preview.parsed.kind, config);

    return {
      input: preview.input,
      detectedKind: preview.parsed.kind,
      targetPath: destination.targetPath,
      state: transfer.status === "planned" ? "ready" : "blocked",
      actions: transfer.actions,
      reason: transfer.summary,
    };
  });
}

export function exportWebdavTransferQueue(previews: PreviewResult[], config?: DestinationProfile): string {
  const items = buildWebdavTransferQueue(previews, config);

  return JSON.stringify({
    backend: "webdav",
    ready: items.filter((item) => item.state === "ready").length,
    blocked: items.filter((item) => item.state === "blocked").length,
    items,
  }, null, 2);
}

export function listExecutionLog(): ExecutionLogEntry[] {
  return loadExecutionLog();
}

function persistExecutionLog(plan: RenamePlan, actions: ExecutionAction[], mode: "apply"): ExecutionLogEntry {
  const entry: ExecutionLogEntry = {
    id: createExecutionId(plan),
    mode,
    sourceName: plan.sourceName,
    proposedPath: plan.proposedPath,
    actions,
    createdAt: new Date().toISOString(),
  };
  pushExecutionLog(entry);
  return entry;
}

function recordUndo(plan: RenamePlan, actions: ExecutionAction[]): ExecutionLogEntry {
  const existing = loadExecutionLog().find((entry) => entry.proposedPath === plan.proposedPath && !entry.undoneAt);
  if (existing) {
    markExecutionUndone(existing.id);
    return {
      ...existing,
      actions,
      mode: "undo",
      undoneAt: new Date().toISOString(),
    };
  }

  return {
    id: createExecutionId(plan),
    mode: "undo",
    sourceName: plan.sourceName,
    proposedPath: plan.proposedPath,
    actions,
    createdAt: new Date().toISOString(),
    undoneAt: new Date().toISOString(),
  };
}

function createExecutionId(plan: RenamePlan): string {
  return `${plan.sourceName}=>${plan.proposedPath}=>${Date.now()}`;
}
