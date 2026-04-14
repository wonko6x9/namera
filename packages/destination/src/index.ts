import type { Phase3DestinationPlan, RenamePlan } from "@namera/core";

export function createPhase3DestinationPlan(plan: RenamePlan, backend: "local" | "webdav" = "webdav"): Phase3DestinationPlan {
  return {
    backend,
    targetPath: plan.proposedPath,
    status: backend === "webdav" ? "stub" : "ready",
    note:
      backend === "webdav"
        ? "Phase 3 stub only. Remote upload/copy verification not implemented yet."
        : "Local destination path ready.",
  };
}
