import { loadConfig, loadCorrections, loadExecutionLog, loadHistory, loadRecentIngestRoots, markExecutionUndone, pushExecutionLog, pushHistory, pushRecentIngestRoots, saveConfig, setCorrection } from "@namera/config";
import type { AppConfig, IngestItem, MatchCandidate, ParsedMedia, PreviewResult, ProviderDiagnostic, ReviewSummary } from "@namera/core";
import { createPhase3DestinationPlan, createPhase3TransferPlan } from "@namera/destination";
import { buildWebdavTransferQueue, createExecutionBatch, createExecutionRecord, createPlannedExecutions, exportPlanSet, exportReviewPlanSet, exportWebdavTransferQueue, summarizeExecutionActions, summarizeWebdavTransferQueue } from "@namera/exec";
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
  removeIngestItem: (input: string) => void;
  clearIngestedItems: () => void;
  setReviewFilter: (filter: AppState["reviewFilter"]) => void;
  setPreviewDestinationBackend: (backend: AppState["previewDestinationBackend"]) => void;
  updateConfig: (patch: Partial<AppConfig>) => void;
  applyNativeExecution: (input: string) => Promise<void>;
  undoNativeExecution: (input: string) => Promise<void>;
  applyVisibleNativeBatch: () => Promise<void>;
  retryFailedNativeBatch: () => Promise<void>;
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
  reviewFilter: "all" | "needs-review" | "provider-backed" | "failed-batch" | "webdav-ready" | "webdav-blocked";
  previewDestinationBackend: "local" | "webdav";
  config: AppConfig;
  nativeExecutionMessage: string;
  nativeBatchResults: NativeBatchResultItem[];
  recentIngestRoots: string[];
}

const state: AppState = {
  textInput: DEFAULT_INPUT,
  ingestedItems: parseTextIngest(DEFAULT_INPUT),
  liveProviderMessage: "No live provider lookup attempted yet",
  providerCandidatesByInput: {},
  providerDiagnosticsByInput: {},
  selectedCandidateKeyByInput: {},
  reviewFilter: "all",
  previewDestinationBackend: "local",
  config: loadConfig(),
  nativeExecutionMessage: hasTauriInvoke()
    ? "Native execution available in Tauri runtime"
    : "Native execution unavailable in browser-only runtime",
  nativeBatchResults: [],
  recentIngestRoots: loadRecentIngestRoots(),
};

export function resetAppState(): void {
  state.textInput = DEFAULT_INPUT;
  state.ingestedItems = parseTextIngest(DEFAULT_INPUT);
  state.liveProviderMessage = "No live provider lookup attempted yet";
  state.providerCandidatesByInput = {};
  state.providerDiagnosticsByInput = {};
  state.selectedCandidateKeyByInput = {};
  state.reviewFilter = "all";
  state.previewDestinationBackend = "local";
  state.config = loadConfig();
  state.nativeExecutionMessage = hasTauriInvoke()
    ? "Native execution available in Tauri runtime"
    : "Native execution unavailable in browser-only runtime";
  state.nativeBatchResults = [];
  state.recentIngestRoots = loadRecentIngestRoots();
}

export function App(): string {
  return renderApp(state);
}

export function createAppController(rerender: (markup: string) => void): AppController {
  async function runNativeBatch(previews: PreviewResult[], summaryLabel = "Batch apply finished"): Promise<void> {
    if (!previews.length) {
      state.nativeExecutionMessage = "No visible items to apply";
      state.nativeBatchResults = [];
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

    state.nativeExecutionMessage = `${summaryLabel}: ${applied} applied, ${skipped} skipped, ${failed} failed`;
    state.nativeBatchResults = batchResults;
  }

  return {
    rerender,
    async ingestFiles(files: File[]) {
      const fileItems = await parseFileListIngest(files);
      state.ingestedItems = fileItems.length ? fileItems : parseTextIngest(state.textInput);
      state.recentIngestRoots = pushRecentIngestRoots(extractRecentRoots(fileItems));
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
    removeIngestItem(input: string) {
      state.ingestedItems = state.ingestedItems.filter((item) => item.name !== input);
      delete state.providerCandidatesByInput[input];
      delete state.providerDiagnosticsByInput[input];
      delete state.selectedCandidateKeyByInput[input];
      state.nativeBatchResults = state.nativeBatchResults.filter((result) => result.input !== input);
      rerender(renderApp(state));
    },
    clearIngestedItems() {
      state.ingestedItems = [];
      state.providerCandidatesByInput = {};
      state.providerDiagnosticsByInput = {};
      state.selectedCandidateKeyByInput = {};
      state.nativeBatchResults = [];
      state.liveProviderMessage = "Queue cleared";
      rerender(renderApp(state));
    },
    setReviewFilter(filter: AppState["reviewFilter"]) {
      state.reviewFilter = filter;
      rerender(renderApp(state));
    },
    setPreviewDestinationBackend(backend: AppState["previewDestinationBackend"]) {
      state.previewDestinationBackend = backend;
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
      await runNativeBatch(getVisiblePreviews(state));
      rerender(renderApp(state));
    },
    async retryFailedNativeBatch() {
      const failedInputs = new Set(
        state.nativeBatchResults.filter((result) => result.outcome === "failed").map((result) => result.input),
      );
      const previews = getAllPreviews(state).filter((preview) => failedInputs.has(preview.input));
      if (!previews.length) {
        state.nativeExecutionMessage = "No failed batch items to retry";
        state.nativeBatchResults = [];
        rerender(renderApp(state));
        return;
      }

      await runNativeBatch(previews, "Retry failed batch finished");
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
  const exportedReviewPlans = exportReviewPlanSet(previews, appState.config.destinations, appState.previewDestinationBackend);
  const exportedVisibleReviewPlans = exportReviewPlanSet(filteredPreviews, appState.config.destinations, appState.previewDestinationBackend);
  const webdavTransferQueue = buildWebdavTransferQueue(filteredPreviews, appState.config.destinations);
  const webdavTransferQueueSummary = summarizeWebdavTransferQueue(webdavTransferQueue);
  const exportedWebdavTransferQueue = exportWebdavTransferQueue(filteredPreviews, appState.config.destinations);
  const exportedReadyWebdavTransferQueue = JSON.stringify(webdavTransferQueue.filter((item) => item.state === "ready"), null, 2);
  const exportedBlockedWebdavTransferQueue = JSON.stringify(webdavTransferQueue.filter((item) => item.state === "blocked"), null, 2);
  const providerSummary = providerStatus(appState.config.providers);
  const webdavTransferSummary = summarizeWebdavTransferState(previews, appState.config);
  const webdavBlockedReasons = summarizeWebdavBlockedReasons(previews, appState.config);
  const webdavReadinessByKind = summarizeWebdavReadinessByKind(previews, appState.config);
  const failedBatchCount = appState.nativeBatchResults.filter((result) => result.outcome === "failed").length;
  const failedBatchExport = exportFailedBatchResults(appState.nativeBatchResults);
  const recentRootsMarkup = appState.recentIngestRoots.length
    ? `<ul>${appState.recentIngestRoots.map((root) => `<li>${escapeHtml(root)}</li>`).join("")}</ul>`
    : "<p>No recent ingest roots yet</p>";
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
        <li>${escapeHtml(item.name)} <small>(${escapeHtml(item.source)}${item.pathHint ? ` • ${escapeHtml(item.pathHint)}` : ""})</small> <button data-role="remove-ingest-item" data-input="${escapeHtmlAttribute(item.name)}" type="button">Remove</button></li>
      `,
    )
    .join("");

  const previewMarkup = filteredPreviews
    .map((preview) => {
      const destination = createPhase3DestinationPlan(
        preview.plan,
        preview.parsed.kind,
        appState.config.destinations,
        appState.previewDestinationBackend,
      );
      const transfer = appState.previewDestinationBackend === "webdav"
        ? createPhase3TransferPlan(preview.plan, preview.parsed.kind, appState.config.destinations)
        : null;
      const request = buildProviderRequest(preview.parsed, appState.config.providers);
      const warningText = preview.plan.warnings.length ? preview.plan.warnings.join("; ") : "none";
      const diagnostics = appState.providerDiagnosticsByInput[preview.input] ?? [];
      const diagnosticsText = diagnostics.length
        ? diagnostics.map((diagnostic) => `${diagnostic.provider}: ${diagnostic.status}${diagnostic.cached ? " (cached)" : ""} - ${diagnostic.detail}`).join("; ")
        : "no provider diagnostics yet";
      const searchUrl = buildMediaSearchUrl(preview.parsed, appState.config);
      const artworkSearchUrl = buildArtworkSearchUrl(preview.parsed);
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
          <p><strong>Destination preview backend:</strong> ${escapeHtml(appState.previewDestinationBackend)}</p>
          <p><strong>Phase 3 destination:</strong> ${escapeHtml(destination.backend)} / ${escapeHtml(destination.status)} / ${escapeHtml(destination.note)}</p>
          <p><strong>Phase 3 transfer:</strong> ${transfer ? `${escapeHtml(transfer.status)} / ${escapeHtml(transfer.summary)}` : "Not needed for local destination preview."}</p>
          <ul>${transfer ? transfer.actions.map((action) => `<li>${escapeHtml(action)}</li>`).join("") : "<li>Local destination preview uses the proposed local path directly.</li>"}</ul>
          <div>
            <button data-role="open-search" data-url="${escapeHtmlAttribute(searchUrl)}" type="button">Search title</button>
            <button data-role="open-art-search" data-url="${escapeHtmlAttribute(artworkSearchUrl)}" type="button">Search poster/cover</button>
          </div>
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
        <p><strong>WebDAV roots:</strong> Movies=${escapeHtml(appState.config.destinations.webdavMovieRoot || "(not set)")}, TV=${escapeHtml(appState.config.destinations.webdavTvRoot || "(not set)")}, Music=${escapeHtml(appState.config.destinations.webdavMusicRoot || "(not set)")}</p>
        <p><strong>Destination preview mode:</strong> ${escapeHtml(appState.previewDestinationBackend)}</p>
        <p><strong>WebDAV transfer readiness:</strong> ${escapeHtml(webdavTransferSummary)}</p>
        <div>
          <strong>WebDAV readiness by kind:</strong>
          ${webdavReadinessByKind.length
            ? `<ul>${webdavReadinessByKind.map((entry) => `<li>${escapeHtml(entry.kind)}: ${escapeHtml(String(entry.ready))} ready, ${escapeHtml(String(entry.blocked))} blocked</li>`).join("")}</ul>`
            : "<p>No queued items to summarize yet.</p>"}
        </div>
        <div>
          <strong>WebDAV blocked reasons:</strong>
          ${webdavBlockedReasons.length
            ? `<ul>${webdavBlockedReasons.map((entry) => `<li>${escapeHtml(String(entry.count))} × ${escapeHtml(entry.reason)}</li>`).join("")}</ul>`
            : "<p>No blocked WebDAV reasons in the current review set.</p>"}
        </div>
        <p><strong>Collision policy:</strong> ${escapeHtml(appState.config.destinations.collisionPolicy || "skip")}</p>
        <p><strong>Providers:</strong> ${escapeHtml(providerSummary)}</p>
        <p><strong>Ingest summary:</strong> ${escapeHtml(summarizeIngest(appState.ingestedItems))}</p>
        <p><strong>Live provider state:</strong> ${escapeHtml(appState.liveProviderMessage)}</p>
        <p><strong>Native execution state:</strong> ${escapeHtml(appState.nativeExecutionMessage)}</p>
        <div>
          <strong>Last batch details:</strong>
          ${batchResultsMarkup}
        </div>
        <div>
          <strong>Failed batch export:</strong>
          <pre>${escapeHtml(failedBatchExport || "No failed batch items to export")}</pre>
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
          <label>Movie search provider
            <select data-role="config-movie-search-provider">
              <option value="imdb" ${(appState.config.providers.movieSearchProvider ?? "imdb") === "imdb" ? "selected" : ""}>IMDb</option>
              <option value="google" ${(appState.config.providers.movieSearchProvider ?? "imdb") === "google" ? "selected" : ""}>Google</option>
            </select>
          </label>
        </div>
        <div>
          <label>TV search provider
            <select data-role="config-tv-search-provider">
              <option value="tvmaze" ${(appState.config.providers.tvSearchProvider ?? "tvmaze") === "tvmaze" ? "selected" : ""}>TVmaze</option>
              <option value="google" ${(appState.config.providers.tvSearchProvider ?? "tvmaze") === "google" ? "selected" : ""}>Google</option>
            </select>
          </label>
        </div>
        <div>
          <label>Music search provider
            <select data-role="config-music-search-provider">
              <option value="musicbrainz" ${(appState.config.providers.musicSearchProvider ?? "musicbrainz") === "musicbrainz" ? "selected" : ""}>MusicBrainz</option>
              <option value="google" ${(appState.config.providers.musicSearchProvider ?? "musicbrainz") === "google" ? "selected" : ""}>Google</option>
            </select>
          </label>
        </div>
        <div>
          <label>Source root <input data-role="config-source-root" value="${escapeHtmlAttribute(appState.config.destinations.sourceRoot ?? ".")}" /></label>
        </div>
        <div>
          <label>Target root <input data-role="config-target-root" value="${escapeHtmlAttribute(appState.config.destinations.targetRoot ?? ".")}" /></label>
        </div>
        <div>
          <label>WebDAV movie root <input data-role="config-webdav-movie-root" value="${escapeHtmlAttribute(appState.config.destinations.webdavMovieRoot ?? "")}" /></label>
        </div>
        <div>
          <label>WebDAV TV root <input data-role="config-webdav-tv-root" value="${escapeHtmlAttribute(appState.config.destinations.webdavTvRoot ?? "")}" /></label>
        </div>
        <div>
          <label>WebDAV music root <input data-role="config-webdav-music-root" value="${escapeHtmlAttribute(appState.config.destinations.webdavMusicRoot ?? "")}" /></label>
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
            <input data-role="file-input" type="file" multiple accept=".mkv,.mp4,.avi,.mov,.m4v,.mp3,.flac,.wav,.srt,.ass,.ssa,.vtt,.sub,.idx" />
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
          <button data-role="clear-ingest" type="button" ${appState.ingestedItems.length ? "" : "disabled"}>Clear queue</button>
        </div>
        <div>
          <strong>Recent ingest roots:</strong>
          ${recentRootsMarkup}
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
          <button data-role="filter-failed-batch" type="button">Failed batch</button>
          <button data-role="filter-webdav-ready" type="button">WebDAV ready</button>
          <button data-role="filter-webdav-blocked" type="button">WebDAV blocked</button>
          <button data-role="preview-backend-local" type="button" ${appState.previewDestinationBackend === "local" ? "disabled" : ""}>Preview local destination</button>
          <button data-role="preview-backend-webdav" type="button" ${appState.previewDestinationBackend === "webdav" ? "disabled" : ""}>Preview WebDAV destination</button>
          <button data-role="apply-visible-batch" type="button" ${hasTauriInvoke() ? "" : "disabled"}>Apply visible batch</button>
          <button data-role="retry-failed-batch" type="button" ${hasTauriInvoke() && failedBatchCount ? "" : "disabled"}>Retry failed batch</button>
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
        <h2>Exported rename plan set</h2>
        <pre>${escapeHtml(exportedPlans)}</pre>
      </section>
      <section>
        <h2>Exported review plan set</h2>
        <p>Includes the currently selected destination preview backend and, when WebDAV preview is selected, the honest transfer contract or blocked reasons.</p>
        <pre>${escapeHtml(exportedReviewPlans)}</pre>
      </section>
      <section>
        <h2>Exported visible review plan set</h2>
        <p>Respects the current review filter so the user can export only the subset they are actively triaging.</p>
        <pre>${escapeHtml(exportedVisibleReviewPlans)}</pre>
      </section>
      <section>
        <h2>Exported WebDAV transfer queue</h2>
        <p>Lists the currently visible items as a truthful remote transfer queue, marking each one as ready or blocked with concrete actions and reasons.</p>
        <p><strong>Visible queue summary:</strong> ${escapeHtml(`${webdavTransferQueueSummary.ready} ready, ${webdavTransferQueueSummary.blocked} blocked`)}</p>
        <pre>${escapeHtml(exportedWebdavTransferQueue)}</pre>
      </section>
      <section>
        <h2>Exported ready WebDAV queue items</h2>
        <p>Only the currently visible items whose WebDAV transfer contract is ready.</p>
        <pre>${escapeHtml(exportedReadyWebdavTransferQueue)}</pre>
      </section>
      <section>
        <h2>Exported blocked WebDAV queue items</h2>
        <p>Only the currently visible items whose WebDAV transfer contract is still blocked.</p>
        <pre>${escapeHtml(exportedBlockedWebdavTransferQueue)}</pre>
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

function summarizeWebdavTransferState(previews: PreviewResult[], config: AppConfig): string {
  const transferPlans = previews.map((preview) => createPhase3TransferPlan(preview.plan, preview.parsed.kind, config.destinations));
  const planned = transferPlans.filter((plan) => plan.status === "planned").length;
  const blocked = transferPlans.length - planned;
  const blockedReasons = summarizeWebdavBlockedReasons(previews, config)
    .map((entry) => `${entry.count} × ${entry.reason}`)
    .join("; ");

  return blocked
    ? `${planned} ready, ${blocked} blocked${blockedReasons ? ` (${blockedReasons})` : ""}`
    : `${planned} ready, 0 blocked`;
}

function summarizeWebdavBlockedReasons(previews: PreviewResult[], config: AppConfig): Array<{ reason: string; count: number }> {
  const blockedReasonCounts = new Map<string, number>();

  for (const plan of previews
    .map((preview) => createPhase3TransferPlan(preview.plan, preview.parsed.kind, config.destinations))
    .filter((plan) => plan.status === "blocked")) {
    blockedReasonCounts.set(plan.summary, (blockedReasonCounts.get(plan.summary) ?? 0) + 1);
  }

  return Array.from(blockedReasonCounts.entries())
    .map(([reason, count]) => ({ reason, count }))
    .sort((left, right) => right.count - left.count || left.reason.localeCompare(right.reason));
}

function summarizeWebdavReadinessByKind(previews: PreviewResult[], config: AppConfig): Array<{ kind: string; ready: number; blocked: number }> {
  const totals = new Map<string, { ready: number; blocked: number }>();

  for (const preview of previews) {
    const kind = preview.parsed.kind;
    const transfer = createPhase3TransferPlan(preview.plan, preview.parsed.kind, config.destinations);
    const current = totals.get(kind) ?? { ready: 0, blocked: 0 };
    if (transfer.status === "planned") {
      current.ready += 1;
    } else {
      current.blocked += 1;
    }
    totals.set(kind, current);
  }

  return Array.from(totals.entries())
    .map(([kind, counts]) => ({ kind, ...counts }))
    .sort((left, right) => left.kind.localeCompare(right.kind));
}

function matchesReviewFilter(preview: PreviewResult, filter: AppState["reviewFilter"]): boolean {
  if (filter === "all") return true;
  if (filter === "provider-backed") return preview.candidate.provider !== "local-heuristic";
  if (filter === "failed-batch") {
    return state.nativeBatchResults.some((result) => result.outcome === "failed" && result.input === preview.input);
  }
  if (filter === "webdav-ready") {
    return createPhase3TransferPlan(preview.plan, preview.parsed.kind, state.config.destinations).status === "planned";
  }
  if (filter === "webdav-blocked") {
    return createPhase3TransferPlan(preview.plan, preview.parsed.kind, state.config.destinations).status === "blocked";
  }
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

function extractRecentRoots(items: IngestItem[]): string[] {
  return items
    .map((item) => item.pathHint)
    .filter((pathHint): pathHint is string => Boolean(pathHint && pathHint.includes("/")))
    .map((pathHint) => pathHint.split("/").slice(0, -1).join("/"))
    .filter(Boolean);
}

export function buildMediaSearchUrl(parsed: ParsedMedia, config: AppConfig): string {
  const query = parsed.kind === "episode" && parsed.episode
    ? `${parsed.episode.seriesTitle ?? parsed.title} S${String(parsed.episode.season).padStart(2, "0")}E${String(parsed.episode.episode).padStart(2, "0")} ${parsed.episode.episodeTitle ?? ""}`.trim()
    : parsed.kind === "movie"
      ? `${parsed.title}${parsed.movie?.year ? ` ${parsed.movie.year}` : ""}`.trim()
      : parsed.title;

  if (parsed.kind === "episode") {
    const provider = config.providers.tvSearchProvider ?? "tvmaze";
    if (provider === "tvmaze") {
      return `https://www.tvmaze.com/search?q=${encodeURIComponent(parsed.episode?.seriesTitle ?? parsed.title)}`;
    }
  }

  if (parsed.kind === "music") {
    const provider = config.providers.musicSearchProvider ?? "musicbrainz";
    if (provider === "musicbrainz") {
      return `https://musicbrainz.org/search?query=${encodeURIComponent(query)}&type=recording&method=indexed`;
    }
  }

  if (parsed.kind === "movie") {
    const provider = config.providers.movieSearchProvider ?? "imdb";
    if (provider === "imdb") {
      return `https://www.imdb.com/find/?q=${encodeURIComponent(query)}`;
    }
  }

  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

export function buildArtworkSearchUrl(parsed: import("@namera/core").ParsedMedia): string {
  const query = parsed.kind === "episode" && parsed.episode
    ? `${parsed.episode.seriesTitle ?? parsed.title} season ${parsed.episode.season} poster`
    : parsed.kind === "movie"
      ? `${parsed.title}${parsed.movie?.year ? ` ${parsed.movie.year}` : ""} movie poster dvd cover`
      : `${parsed.title} album cover`;

  return `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(query)}`;
}

export function exportFailedBatchResults(results: NativeBatchResultItem[]): string {
  const failed = results
    .filter((result) => result.outcome === "failed")
    .map((result) => ({ input: result.input, summary: result.summary }));

  return failed.length ? JSON.stringify(failed, null, 2) : "";
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
