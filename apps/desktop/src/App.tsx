import { loadConfig, loadCorrections, loadExecutionLog, loadHistory, markExecutionUndone, pushExecutionLog, pushHistory, saveConfig, setCorrection } from "@namera/config";
import type { AppConfig, IngestItem, MatchCandidate, PreviewResult, ProviderDiagnostic, ReviewSummary } from "@namera/core";
import { createPhase3DestinationPlan } from "@namera/destination";
import { createExecutionBatch, createExecutionRecord, createPlannedExecutions, exportPlanSet, summarizeExecutionActions } from "@namera/exec";
import { parseFileListIngest, parseTextIngest } from "@namera/ingest";
import { buildCorrectionKey, getCandidateKey, rankCandidates } from "@namera/match";
import { parseFilename } from "@namera/parse";
import { buildPlan } from "@namera/plan";
import { buildProviderRequest, fetchProviderLookup, providerStatus } from "@namera/provider";
import { applyExecutionBatchNative, hasTauriInvoke, undoExecutionBatchNative } from "./tauri";

const DEFAULT_INPUT = `The.Matrix.1999.1080p.BluRay.mkv
Severance.S01E01.Good.News.About.Hell.2160p.WEB-DL.mkv
Andor__S01E03---Reckoning..WEBRip.mp4
Some.Confusing.File.Name.Thing.bin`;

export interface AppController {
  rerender: (markup: string) => void;
  ingestFiles: (files: File[]) => Promise<void>;
  refreshProviders: () => Promise<void>;
  chooseCandidate: (input: string, candidateKey: string) => void;
  rememberCandidateChoice: (input: string, candidateKey: string) => void;
  setReviewFilter: (filter: AppState["reviewFilter"]) => void;
  updateConfig: (patch: Partial<AppConfig>) => void;
  applyNativeExecution: (input: string) => Promise<void>;
  undoNativeExecution: (input: string) => Promise<void>;
  applyVisibleNativeBatch: () => Promise<void>;
}

interface NativeBatchResultItem {
  input: string;
  outcome: "applied" | "skipped" | "failed";
  summary: string;
}

interface AppState {
  textInput: string;
  ingestedItems: IngestItem[];
  liveProviderMessage: string;
  providerCandidatesByInput: Record<string, MatchCandidate[]>;
  providerDiagnosticsByInput: Record<string, ProviderDiagnostic[]>;
  selectedCandidateKeyByInput: Record<string, string>;
  reviewFilter: "all" | "needs-review" | "provider-backed";
  config: AppConfig;
  nativeExecutionMessage: string;
  nativeBatchResults: NativeBatchResultItem[];
}

const state: AppState = {
  textInput: DEFAULT_INPUT,
  ingestedItems: parseTextIngest(DEFAULT_INPUT),
  liveProviderMessage: "No live provider lookup attempted yet",
  providerCandidatesByInput: {},
  providerDiagnosticsByInput: {},
  selectedCandidateKeyByInput: {},
  reviewFilter: "all",
  config: loadConfig(),
  nativeExecutionMessage: hasTauriInvoke()
    ? "Native execution available in Tauri runtime"
    : "Native execution unavailable in browser-only runtime",
  nativeBatchResults: [],
};

export function App(): string {
  return renderApp(state);
}

export function createAppController(rerender: (markup: string) => void): AppController {
  return {
    rerender,
    async ingestFiles(files: File[]) {
      const fileItems = await parseFileListIngest(files);
      state.ingestedItems = fileItems.length ? fileItems : parseTextIngest(state.textInput);
      rerender(renderApp(state));
    },
    async refreshProviders() {
      if (!state.ingestedItems.length) {
        state.liveProviderMessage = "Nothing ingested yet";
        rerender(renderApp(state));
        return;
      }

      const providerCandidatesByInput: Record<string, MatchCandidate[]> = {};
      const providerDiagnosticsByInput: Record<string, ProviderDiagnostic[]> = {};
      for (const item of state.ingestedItems.slice(0, 10)) {
        const parsed = parseFilename(item.name);
        const lookup = await fetchProviderLookup(parsed, state.config.providers);
        providerCandidatesByInput[item.name] = lookup.candidates;
        providerDiagnosticsByInput[item.name] = lookup.diagnostics;
      }

      state.providerCandidatesByInput = providerCandidatesByInput;
      state.providerDiagnosticsByInput = providerDiagnosticsByInput;
      const totalLiveCandidates = Object.values(providerCandidatesByInput).reduce((sum, candidates) => sum + candidates.length, 0);
      state.liveProviderMessage = totalLiveCandidates
        ? `Live provider lookup loaded ${totalLiveCandidates} candidate${totalLiveCandidates === 1 ? "" : "s"}`
        : state.config.providers.omdbApiKey
          ? "Live provider lookup ran, but found no candidates"
          : "Live provider lookup unavailable until an OMDb API key is configured";
      rerender(renderApp(state));
    },
    chooseCandidate(input: string, candidateKey: string) {
      state.selectedCandidateKeyByInput[input] = candidateKey;
      rerender(renderApp(state));
    },
    rememberCandidateChoice(input: string, candidateKey: string) {
      state.selectedCandidateKeyByInput[input] = candidateKey;
      const parsed = parseFilename(input);
      const candidates = rankCandidates(parsed, state.providerCandidatesByInput[input] ?? []);
      const chosen = candidates.find((candidate) => getCandidateKey(candidate) === candidateKey);
      if (chosen) {
        setCorrection({
          key: buildCorrectionKey(parsed),
          candidateKey,
          displayName: chosen.displayName,
          provider: chosen.provider,
          updatedAt: new Date().toISOString(),
        });
      }
      rerender(renderApp(state));
    },
    setReviewFilter(filter: AppState["reviewFilter"]) {
      state.reviewFilter = filter;
      rerender(renderApp(state));
    },
    updateConfig(patch: Partial<AppConfig>) {
      state.config = mergeConfig(state.config, patch);
      saveConfig(state.config);
      rerender(renderApp(state));
    },
    async applyNativeExecution(input: string) {
      try {
        const batch = await applyExecutionBatchNative(
          state.config.destinations.sourceRoot || ".",
          state.config.destinations.targetRoot || ".",
          input,
          state.config.destinations.collisionPolicy,
        );
        if (batch.log_entry) {
          pushExecutionLog(mapNativeLogEntry(batch.log_entry));
        }
        state.nativeExecutionMessage = batch.summary;
        state.nativeBatchResults = [];
      } catch (error) {
        state.nativeExecutionMessage = `Native apply failed: ${error instanceof Error ? error.message : String(error)}`;
        state.nativeBatchResults = [];
      }
      rerender(renderApp(state));
    },
    async undoNativeExecution(input: string) {
      try {
        const applyEntry = loadExecutionLog().find((entry) => entry.mode === "apply" && entry.sourceName === input && !entry.undoneAt);
        const batch = await undoExecutionBatchNative(
          state.config.destinations.sourceRoot || ".",
          state.config.destinations.targetRoot || ".",
          input,
          applyEntry?.id,
          applyEntry?.sourceSizeBytes,
          applyEntry?.proposedPath,
        );
        if (applyEntry?.id) {
          markExecutionUndone(applyEntry.id);
        }
        if (batch.log_entry) {
          pushExecutionLog(mapNativeLogEntry(batch.log_entry));
        }
        state.nativeExecutionMessage = batch.summary;
        state.nativeBatchResults = [];
      } catch (error) {
        state.nativeExecutionMessage = `Native undo failed: ${error instanceof Error ? error.message : String(error)}`;
        state.nativeBatchResults = [];
      }
      rerender(renderApp(state));
    },
    async applyVisibleNativeBatch() {
      const previews = getVisiblePreviews(state);
      if (!previews.length) {
        state.nativeExecutionMessage = "No visible items to apply";
        rerender(renderApp(state));
        return;
      }

      let applied = 0;
      let skipped = 0;
      let failed = 0;
      const batchResults: NativeBatchResultItem[] = [];

      for (const preview of previews) {
        try {
          const batch = await applyExecutionBatchNative(
            state.config.destinations.sourceRoot || ".",
            state.config.destinations.targetRoot || ".",
            preview.input,
            state.config.destinations.collisionPolicy,
          );
          if (batch.log_entry) {
            pushExecutionLog(mapNativeLogEntry(batch.log_entry));
          }
          if (batch.actions.some((action) => action.status === "skipped")) {
            skipped += 1;
            batchResults.push({ input: preview.input, outcome: "skipped", summary: batch.summary });
          } else {
            applied += 1;
            batchResults.push({ input: preview.input, outcome: "applied", summary: batch.summary });
          }
        } catch (error) {
          failed += 1;
          batchResults.push({
            input: preview.input,
            outcome: "failed",
            summary: error instanceof Error ? error.message : String(error),
          });
        }
      }

      state.nativeExecutionMessage = `Batch apply finished: ${applied} applied, ${skipped} skipped, ${failed} failed`;
      state.nativeBatchResults = batchResults;
      rerender(renderApp(state));
    },
  };
}

function renderApp(appState: AppState): string {
  const previews = getAllPreviews(appState);
  const reviewSummary = summarizeReview(previews);
  const filteredPreviews = previews.filter((preview) => matchesReviewFilter(preview, appState.reviewFilter));
  const persistedHistory = previews.map((preview) => pushHistory(createExecutionRecord(preview.plan)));
  const history = persistedHistory.at(-1) ?? loadHistory();
  const executionLog = loadExecutionLog();
  const corrections = loadCorrections();
  const exportedPlans = exportPlanSet(previews.map((preview) => preview.plan));
  const providerSummary = providerStatus(appState.config.providers);
  const batchResultsMarkup = appState.nativeBatchResults.length
    ? `<ul>${appState.nativeBatchResults
        .map(
          (result) =>
            `<li><strong>${escapeHtml(result.outcome)}:</strong> ${escapeHtml(result.input)} <small>${escapeHtml(result.summary)}</small></li>`,
        )
        .join("")}</ul>`
    : "<p>No batch results yet</p>";

  const ingestMarkup = appState.ingestedItems
    .map(
      (item) => `
        <li>${escapeHtml(item.name)} <small>(${escapeHtml(item.source)}${item.pathHint ? ` • ${escapeHtml(item.pathHint)}` : ""})</small></li>
      `,
    )
    .join("");

  const previewMarkup = filteredPreviews
    .map((preview) => {
      const destination = createPhase3DestinationPlan(preview.plan, "webdav");
      const request = buildProviderRequest(preview.parsed, appState.config.providers);
      const warningText = preview.plan.warnings.length ? preview.plan.warnings.join("; ") : "none";
      const diagnostics = appState.providerDiagnosticsByInput[preview.input] ?? [];
      const diagnosticsText = diagnostics.length
        ? diagnostics.map((diagnostic) => `${diagnostic.provider}: ${diagnostic.status}${diagnostic.cached ? " (cached)" : ""} - ${diagnostic.detail}`).join("; ")
        : "no provider diagnostics yet";
      const executionActions = createPlannedExecutions(preview.plan);
      const dryRunBatch = createExecutionBatch(preview.plan, "dry-run");
      const applyBatch = createExecutionBatch(preview.plan, "apply");
      const undoBatch = createExecutionBatch(preview.plan, "undo");
      const candidateList = (preview.candidates ?? [])
        .slice(0, 5)
        .map((candidate) => {
          const key = getCandidateKey(candidate);
          return `<button data-role="candidate-pick" data-input="${escapeHtmlAttribute(preview.input)}" data-key="${escapeHtmlAttribute(key)}" type="button" title="${escapeHtmlAttribute(candidate.reason)}">${escapeHtml(candidate.displayName)} (${escapeHtml(candidate.provider)}, ${candidate.score}%, ${escapeHtml(candidate.confidenceLabel ?? "unknown")})</button> <button data-role="candidate-remember" data-input="${escapeHtmlAttribute(preview.input)}" data-key="${escapeHtmlAttribute(key)}" type="button">Remember</button>`;
        })
        .join(" ");

      return `
        <article>
          <h3>${escapeHtml(preview.input)}</h3>
          <p><strong>Detected:</strong> ${escapeHtml(preview.candidate.displayName)} (${preview.candidate.score}%, ${escapeHtml(preview.candidate.confidenceLabel ?? "unknown")})</p>
          <p><strong>Why this match:</strong> ${escapeHtml(preview.candidate.reason)}</p>
          <p><strong>Kind:</strong> ${escapeHtml(preview.parsed.kind)}</p>
          <p><strong>Title:</strong> ${escapeHtml(preview.parsed.title)}</p>
          <p><strong>Proposed path:</strong> ${escapeHtml(preview.plan.proposedPath)}</p>
          <p><strong>Warnings:</strong> ${escapeHtml(warningText)}</p>
          <p><strong>Candidate override:</strong> ${candidateList || "none"}</p>
          <p><strong>Execution plan:</strong> ${escapeHtml(summarizeExecutionActions(executionActions))}</p>
          <p><strong>Dry run:</strong> ${escapeHtml(dryRunBatch.summary)}</p>
          <p><strong>Apply contract:</strong> ${escapeHtml(applyBatch.summary)}</p>
          <p><strong>Undo contract:</strong> ${escapeHtml(undoBatch.summary)}</p>
          <p><strong>Native execution:</strong> ${hasTauriInvoke() ? "available" : "not available in this runtime"}</p>
          <div>
            <button data-role="apply-native" data-input="${escapeHtmlAttribute(preview.input)}" type="button" ${hasTauriInvoke() ? "" : "disabled"}>Apply natively</button>
            <button data-role="undo-native" data-input="${escapeHtmlAttribute(preview.input)}" type="button" ${hasTauriInvoke() ? "" : "disabled"}>Undo natively</button>
          </div>
          <ul>${executionActions
            .map(
              (action) =>
                `<li>${escapeHtml(action.type)} → ${escapeHtml(action.toPath)}${action.fromPath ? ` <small>from ${escapeHtml(action.fromPath)}</small>` : ""}</li>`,
            )
            .join("")}</ul>
          <p><strong>Provider request:</strong> <code>${escapeHtml(JSON.stringify(request))}</code></p>
          <p><strong>Provider diagnostics:</strong> ${escapeHtml(diagnosticsText)}</p>
          <p><strong>Phase 3 destination:</strong> ${escapeHtml(destination.backend)} / ${escapeHtml(destination.status)} / ${escapeHtml(destination.note)}</p>
        </article>
      `;
    })
    .join("");

  const historyMarkup = history
    .slice(0, 5)
    .map(
      (entry) => `
        <li>${escapeHtml(entry.sourceName)} → ${escapeHtml(entry.proposedPath)} (${entry.confidence}%)</li>
      `,
    )
    .join("");

  const executionLogMarkup = executionLog
    .slice(0, 5)
    .map(
      (entry) => `
        <li>${escapeHtml(entry.mode)} • ${escapeHtml(entry.sourceName)} → ${escapeHtml(entry.proposedPath)} <small>${escapeHtml(entry.createdAt)}${entry.undoneAt ? ` • undone ${escapeHtml(entry.undoneAt)}` : ""}</small></li>
      `,
    )
    .join("");

  return `
    <main>
      <section class="namera-hero">
        <img src="/namera-logo-placeholder.svg" alt="Namera placeholder logo" />
        <div class="namera-hero-copy">
          <h1>Namera</h1>
          <p>Plex-focused media matching, rename planning, and now an actual native execution lane instead of pure cosplay.</p>
          <div class="namera-chiprow">
            <span class="namera-chip">Windows + Linux first</span>
            <span class="namera-chip">Tauri + Rust core</span>
            <span class="namera-chip">Tag · Rename · Organize</span>
          </div>
        </div>
      </section>
      <section>
        <h2>Status</h2>
        <p><strong>Destination roots:</strong> Movies=${escapeHtml(appState.config.destinations.movieRoot)}, TV=${escapeHtml(appState.config.destinations.tvRoot)}, Music=${escapeHtml(appState.config.destinations.musicRoot)}</p>
        <p><strong>Execution roots:</strong> Source=${escapeHtml(appState.config.destinations.sourceRoot || ".")}, Target=${escapeHtml(appState.config.destinations.targetRoot || ".")}</p>
        <p><strong>Collision policy:</strong> ${escapeHtml(appState.config.destinations.collisionPolicy || "skip")}</p>
        <p><strong>Providers:</strong> ${escapeHtml(providerSummary)}</p>
        <p><strong>Ingest summary:</strong> ${escapeHtml(summarizeIngest(appState.ingestedItems))}</p>
        <p><strong>Live provider state:</strong> ${escapeHtml(appState.liveProviderMessage)}</p>
        <p><strong>Native execution state:</strong> ${escapeHtml(appState.nativeExecutionMessage)}</p>
        <div>
          <strong>Last batch details:</strong>
          ${batchResultsMarkup}
        </div>
      </section>
      <section>
        <h2>Configuration</h2>
        <div>
          <label>Movie root <input data-role="config-movie-root" value="${escapeHtmlAttribute(appState.config.destinations.movieRoot)}" /></label>
        </div>
        <div>
          <label>TV root <input data-role="config-tv-root" value="${escapeHtmlAttribute(appState.config.destinations.tvRoot)}" /></label>
        </div>
        <div>
          <label>Music root <input data-role="config-music-root" value="${escapeHtmlAttribute(appState.config.destinations.musicRoot)}" /></label>
        </div>
        <div>
          <label>OMDb API key <input data-role="config-omdb-key" value="${escapeHtmlAttribute(appState.config.providers.omdbApiKey ?? "")}" /></label>
        </div>
        <div>
          <label>Source root <input data-role="config-source-root" value="${escapeHtmlAttribute(appState.config.destinations.sourceRoot ?? ".")}" /></label>
        </div>
        <div>
          <label>Target root <input data-role="config-target-root" value="${escapeHtmlAttribute(appState.config.destinations.targetRoot ?? ".")}" /></label>
        </div>
        <div>
          <label>Collision policy
            <select data-role="config-collision-policy">
              <option value="skip" ${(appState.config.destinations.collisionPolicy ?? "skip") === "skip" ? "selected" : ""}>skip existing</option>
              <option value="overwrite" ${(appState.config.destinations.collisionPolicy ?? "skip") === "overwrite" ? "selected" : ""}>overwrite existing</option>
              <option value="rename-new" ${(appState.config.destinations.collisionPolicy ?? "skip") === "rename-new" ? "selected" : ""}>rename new file</option>
            </select>
          </label>
        </div>
        <button data-role="save-config" type="button">Save config</button>
      </section>
      <section>
        <h2>Ingest</h2>
        <p>Text input still works, but the MVP now has actual file and folder pickers driving the same preview flow.</p>
        <textarea rows="6" cols="80">${escapeHtml(appState.textInput)}</textarea>
        <div>
          <label>
            <strong>Pick files:</strong>
            <input data-role="file-input" type="file" multiple accept=".mkv,.mp4,.avi,.mov,.m4v,.mp3,.flac,.wav" />
          </label>
        </div>
        <div>
          <label>
            <strong>Pick folder:</strong>
            <input data-role="folder-input" type="file" webkitdirectory directory multiple />
          </label>
        </div>
        <div>
          <button data-role="refresh-providers" type="button">Try live metadata lookup</button>
        </div>
        <ul>${ingestMarkup}</ul>
      </section>
      <section>
        <h2>Batch review</h2>
        <p><strong>Summary:</strong> ${escapeHtml(formatReviewSummary(reviewSummary))}</p>
        <div>
          <button data-role="filter-all" type="button">All</button>
          <button data-role="filter-needs-review" type="button">Needs review</button>
          <button data-role="filter-provider-backed" type="button">Provider-backed</button>
          <button data-role="apply-visible-batch" type="button" ${hasTauriInvoke() ? "" : "disabled"}>Apply visible batch</button>
        </div>
        <p><strong>Current filter:</strong> ${escapeHtml(appState.reviewFilter)}</p>
        ${previewMarkup || "<p>No items match the current review filter.</p>"}
      </section>
      <section>
        <h2>Recent history</h2>
        <ul>${historyMarkup}</ul>
      </section>
      <section>
        <h2>Execution log</h2>
        <p>Apply and undo actions are now persisted as an honest local log, even before native filesystem execution lands.</p>
        <ul>${executionLogMarkup || "<li>No execution records yet</li>"}</ul>
      </section>
      <section>
        <h2>Remembered corrections</h2>
        <p>Sticky corrections now bias future candidate ranking for the same parsed title or episode key.</p>
        <ul>${Object.values(corrections).length ? Object.values(corrections).map((correction) => `<li>${escapeHtml(correction.key)} → ${escapeHtml(correction.displayName)} (${escapeHtml(correction.provider)})</li>`).join("") : "<li>No remembered corrections yet</li>"}</ul>
      </section>
      <section>
        <h2>Exported plan set</h2>
        <pre>${escapeHtml(exportedPlans)}</pre>
      </section>
    </main>
  `;
}

function getAllPreviews(appState: AppState): PreviewResult[] {
  return appState.ingestedItems.map((item) =>
    buildPreview(
      item.name,
      appState.providerCandidatesByInput[item.name] ?? [],
      appState.selectedCandidateKeyByInput[item.name],
      appState.config,
    ),
  );
}

function getVisiblePreviews(appState: AppState): PreviewResult[] {
  return getAllPreviews(appState).filter((preview) => matchesReviewFilter(preview, appState.reviewFilter));
}

export function buildPreview(
  input: string,
  providerCandidates: MatchCandidate[] = [],
  selectedCandidateKey?: string,
  config?: AppConfig,
): PreviewResult {
  const parsed = parseFilename(input);
  const rankedCandidates = rankCandidates(parsed, providerCandidates);
  const candidates = reorderCandidates(rankedCandidates, selectedCandidateKey);
  const selectedCandidate = candidates[0] ?? rankedCandidates[0]!;
  const plan = buildPlan(parsed, selectedCandidate, config?.destinations);
  return { input, parsed, candidate: selectedCandidate, plan, candidates };
}

export function summarizeIngest(items: IngestItem[]): string {
  if (!items.length) return "No inputs ingested";
  return `${items.length} input${items.length === 1 ? "" : "s"} ingested`;
}

export function summarizeReview(previews: PreviewResult[]): ReviewSummary {
  return previews.reduce<ReviewSummary>(
    (summary, preview) => {
      summary.total += 1;
      if ((preview.candidate.confidenceLabel ?? "low") === "low" || preview.candidate.provider === "local-heuristic") {
        summary.lowConfidence += 1;
      }
      if (preview.candidate.provider === "local-heuristic") {
        summary.heuristicOnly += 1;
      } else {
        summary.providerBacked += 1;
      }
      return summary;
    },
    { total: 0, lowConfidence: 0, providerBacked: 0, heuristicOnly: 0 },
  );
}

function formatReviewSummary(summary: ReviewSummary): string {
  return `${summary.total} items, ${summary.lowConfidence} need review, ${summary.providerBacked} provider-backed, ${summary.heuristicOnly} heuristic-only`;
}

function matchesReviewFilter(preview: PreviewResult, filter: AppState["reviewFilter"]): boolean {
  if (filter === "all") return true;
  if (filter === "provider-backed") return preview.candidate.provider !== "local-heuristic";
  return preview.candidate.provider === "local-heuristic" || (preview.candidate.confidenceLabel ?? "low") === "low";
}

function reorderCandidates(candidates: MatchCandidate[], selectedKey?: string): MatchCandidate[] {
  if (!selectedKey) {
    return candidates;
  }

  const selectedIndex = candidates.findIndex((candidate) => getCandidateKey(candidate) === selectedKey);
  if (selectedIndex <= 0) {
    return candidates;
  }

  const next = [...candidates];
  const [selected] = next.splice(selectedIndex, 1);
  if (selected) {
    next.unshift(selected);
  }
  return next;
}

function mergeConfig(current: AppConfig, patch: Partial<AppConfig>): AppConfig {
  return {
    destinations: {
      ...current.destinations,
      ...patch.destinations,
    },
    providers: {
      ...current.providers,
      ...patch.providers,
    },
  };
}

function getCandidateKey(candidate: MatchCandidate): string {
  return `${candidate.provider}:${candidate.providerId ?? candidate.displayName}`;
}

function mapNativeLogEntry(entry: import("./tauri").NativeExecutionLogEntry): import("@namera/core").ExecutionLogEntry {
  return {
    id: entry.id,
    mode: entry.mode as "apply" | "undo",
    sourceName: entry.source_name,
    proposedPath: entry.proposed_path,
    createdAt: entry.created_at,
    undoneAt: entry.undone_at ?? undefined,
    sourceSizeBytes: entry.source_size_bytes ?? undefined,
    applyLogId: entry.apply_log_id ?? undefined,
    actions: entry.actions.map((action) => ({
      type: mapActionType(action.action_type),
      fromPath: action.from_path ?? undefined,
      toPath: action.to_path,
      status: mapActionStatus(action.status),
      note: action.note ?? undefined,
    })),
  };
}

function mapActionType(value: string): "rename" | "move" | "mkdir" {
  if (value === "move" || value === "mkdir") return value;
  return "rename";
}

function mapActionStatus(value: string): "planned" | "applied" | "failed" | "reverted" | "skipped" {
  if (value === "applied" || value === "failed" || value === "reverted" || value === "skipped") return value;
  return "planned";
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeHtmlAttribute(value: string): string {
  return escapeHtml(value).replaceAll("`", "&#96;");
}
