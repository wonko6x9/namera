export interface NativeExecutionAction {
  action_type: string;
  from_path?: string | null;
  to_path: string;
  status: string;
  note?: string | null;
}

export interface NativeExecutionLogEntry {
  id: string;
  mode: string;
  source_name: string;
  proposed_path: string;
  actions: NativeExecutionAction[];
  created_at: string;
  undone_at?: string | null;
}

export interface NativeExecutionBatch {
  mode: string;
  actions: NativeExecutionAction[];
  summary: string;
  log_entry?: NativeExecutionLogEntry | null;
}

type InvokeFn = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;

declare global {
  interface Window {
    __TAURI__?: {
      core?: {
        invoke?: InvokeFn;
      };
    };
  }
}

function getInvoke(): InvokeFn | undefined {
  if (typeof window === "undefined") return undefined;
  return window.__TAURI__?.core?.invoke;
}

export function hasTauriInvoke(): boolean {
  return typeof getInvoke() === "function";
}

export async function applyExecutionBatchNative(sourceRoot: string, targetRoot: string, input: string): Promise<NativeExecutionBatch> {
  const invoke = getInvoke();
  if (!invoke) throw new Error("Tauri invoke unavailable in this runtime");
  return invoke<NativeExecutionBatch>("apply_execution_batch_command", { sourceRoot, targetRoot, input });
}

export async function undoExecutionBatchNative(sourceRoot: string, targetRoot: string, input: string): Promise<NativeExecutionBatch> {
  const invoke = getInvoke();
  if (!invoke) throw new Error("Tauri invoke unavailable in this runtime");
  return invoke<NativeExecutionBatch>("undo_execution_batch_command", { sourceRoot, targetRoot, input });
}
