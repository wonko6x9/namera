import { loadConfig, loadHistory, pushHistory } from "@namera/config";
import type { IngestItem, MatchCandidate, PreviewResult } from "@namera/core";
import { createPhase3DestinationPlan } from "@namera/destination";
import { createExecutionRecord, createPlannedExecutions, exportPlanSet, summarizeExecutionActions } from "@namera/exec";
import { parseFileListIngest, parseTextIngest } from "@namera/ingest";
import { rankCandidates } from "@namera/match";
import { parseFilename } from "@namera/parse";
import { buildPlan } from "@namera/plan";
import { buildProviderRequest, fetchProviderCandidates, providerStatus } from "@namera/provider";

const DEFAULT_INPUT = `The.Matrix.1999.1080p.BluRay.mkv
Severance.S01E01.Good.News.About.Hell.2160p.WEB-DL.mkv
Andor__S01E03---Reckoning..WEBRip.mp4
Some.Confusing.File.Name.Thing.bin`;

export interface AppController {
  rerender: (markup: string) => void;
  ingestFiles: (files: File[]) => Promise<void>;
  refreshProviders: () => Promise<void>;
  chooseCandidate: (input: string, candidateKey: string) => void;
}

interface AppState {
  textInput: string;
  ingestedItems: IngestItem[];
  liveProviderMessage: string;
  providerCandidatesByInput: Record<string, MatchCandidate[]>;
  selectedCandidateKeyByInput: Record<string, string>;
}

const state: AppState = {
  textInput: DEFAULT_INPUT,
  ingestedItems: parseTextIngest(DEFAULT_INPUT),
  liveProviderMessage: "No live provider lookup attempted yet",
  providerCandidatesByInput: {},
  selectedCandidateKeyByInput: {},
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
      const config = loadConfig();
      if (!state.ingestedItems.length) {
        state.liveProviderMessage = "Nothing ingested yet";
        rerender(renderApp(state));
        return;
      }

      const providerCandidatesByInput: Record<string, MatchCandidate[]> = {};
      for (const item of state.ingestedItems.slice(0, 10)) {
        const parsed = parseFilename(item.name);
        providerCandidatesByInput[item.name] = await fetchProviderCandidates(parsed, config.providers);
      }

      state.providerCandidatesByInput = providerCandidatesByInput;
      const totalLiveCandidates = Object.values(providerCandidatesByInput).reduce((sum, candidates) => sum + candidates.length, 0);
      state.liveProviderMessage = totalLiveCandidates
        ? `Live provider lookup loaded ${totalLiveCandidates} candidate${totalLiveCandidates === 1 ? "" : "s"}`
        : config.providers.omdbApiKey
          ? "Live provider lookup ran, but found no candidates"
          : "Live provider lookup unavailable until an OMDb API key is configured";
      rerender(renderApp(state));
    },
    chooseCandidate(input: string, candidateKey: string) {
      state.selectedCandidateKeyByInput[input] = candidateKey;
      rerender(renderApp(state));
    },
  };
}

function renderApp(appState: AppState): string {
  const config = loadConfig();
  const previews = appState.ingestedItems.map((item) =>
    buildPreview(item.name, appState.providerCandidatesByInput[item.name] ?? [], appState.selectedCandidateKeyByInput[item.name]),
  );
  const persistedHistory = previews.map((preview) => pushHistory(createExecutionRecord(preview.plan)));
  const history = persistedHistory.at(-1) ?? loadHistory();
  const exportedPlans = exportPlanSet(previews.map((preview) => preview.plan));
  const providerSummary = providerStatus(config.providers);

  const ingestMarkup = appState.ingestedItems
    .map(
      (item) => `
        <li>${escapeHtml(item.name)} <small>(${escapeHtml(item.source)}${item.pathHint ? ` • ${escapeHtml(item.pathHint)}` : ""})</small></li>
      `,
    )
    .join("");

  const previewMarkup = previews
    .map((preview) => {
      const destination = createPhase3DestinationPlan(preview.plan, "webdav");
      const request = buildProviderRequest(preview.parsed, config.providers);
      const warningText = preview.plan.warnings.length ? preview.plan.warnings.join("; ") : "none";
      const executionActions = createPlannedExecutions(preview.plan);
      const candidateList = (preview.candidates ?? [])
        .slice(0, 5)
        .map(
          (candidate, index) =>
            `<button data-role="candidate-pick" data-input="${escapeHtmlAttribute(preview.input)}" data-key="${escapeHtmlAttribute(getCandidateKey(candidate))}" type="button">${escapeHtml(candidate.displayName)} (${escapeHtml(candidate.provider)}, ${candidate.score}%)</button>`,
        )
        .join(" ");

      return `
        <article>
          <h3>${escapeHtml(preview.input)}</h3>
          <p><strong>Detected:</strong> ${escapeHtml(preview.candidate.displayName)} (${preview.candidate.score}%)</p>
          <p><strong>Kind:</strong> ${escapeHtml(preview.parsed.kind)}</p>
          <p><strong>Title:</strong> ${escapeHtml(preview.parsed.title)}</p>
          <p><strong>Proposed path:</strong> ${escapeHtml(preview.plan.proposedPath)}</p>
          <p><strong>Warnings:</strong> ${escapeHtml(warningText)}</p>
          <p><strong>Candidate override:</strong> ${candidateList || "none"}</p>
          <p><strong>Execution plan:</strong> ${escapeHtml(summarizeExecutionActions(executionActions))}</p>
          <ul>${executionActions
            .map(
              (action) =>
                `<li>${escapeHtml(action.type)} → ${escapeHtml(action.toPath)}${action.fromPath ? ` <small>from ${escapeHtml(action.fromPath)}</small>` : ""}</li>`,
            )
            .join("")}</ul>
          <p><strong>Provider request:</strong> <code>${escapeHtml(JSON.stringify(request))}</code></p>
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

  return `
    <main>
      <h1>Namera</h1>
      <p>MVP desktop shell for turning ugly media filenames into batch rename previews.</p>
      <section>
        <h2>Status</h2>
        <p><strong>Destination roots:</strong> Movies=${escapeHtml(config.destinations.movieRoot)}, TV=${escapeHtml(config.destinations.tvRoot)}, Music=${escapeHtml(config.destinations.musicRoot)}</p>
        <p><strong>Providers:</strong> ${escapeHtml(providerSummary)}</p>
        <p><strong>Ingest summary:</strong> ${escapeHtml(summarizeIngest(appState.ingestedItems))}</p>
        <p><strong>Live provider state:</strong> ${escapeHtml(appState.liveProviderMessage)}</p>
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
        <h2>Batch preview</h2>
        ${previewMarkup}
      </section>
      <section>
        <h2>Recent history</h2>
        <ul>${historyMarkup}</ul>
      </section>
      <section>
        <h2>Exported plan set</h2>
        <pre>${escapeHtml(exportedPlans)}</pre>
      </section>
    </main>
  `;
}

export function buildPreview(
  input: string,
  providerCandidates: MatchCandidate[] = [],
  selectedCandidateKey?: string,
): PreviewResult {
  const parsed = parseFilename(input);
  const rankedCandidates = rankCandidates(parsed, providerCandidates);
  const candidates = reorderCandidates(rankedCandidates, selectedCandidateKey);
  const selectedCandidate = candidates[0] ?? rankedCandidates[0]!;
  const plan = buildPlan(parsed, selectedCandidate);
  return { input, parsed, candidate: selectedCandidate, plan, candidates };
}

export function summarizeIngest(items: IngestItem[]): string {
  if (!items.length) return "No inputs ingested";
  return `${items.length} input${items.length === 1 ? "" : "s"} ingested`;
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

function getCandidateKey(candidate: MatchCandidate): string {
  return `${candidate.provider}:${candidate.providerId ?? candidate.displayName}`;
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
