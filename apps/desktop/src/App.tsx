import { loadConfig, loadHistory, pushHistory } from "@namera/config";
import type { PreviewResult } from "@namera/core";
import { createPhase3DestinationPlan } from "@namera/destination";
import { createExecutionRecord, exportPlanSet } from "@namera/exec";
import { rankCandidates } from "@namera/match";
import { parseFilename } from "@namera/parse";
import { buildPlan } from "@namera/plan";
import { buildProviderRequest, providerStatus } from "@namera/provider";

const SAMPLE_INPUTS = [
  "The.Matrix.1999.1080p.BluRay.mkv",
  "Severance.S01E01.Good.News.About.Hell.2160p.WEB-DL.mkv",
  "Andor__S01E03---Reckoning..WEBRip.mp4",
  "Some.Confusing.File.Name.Thing.bin",
];

export function App(): string {
  const config = loadConfig();
  const previews = SAMPLE_INPUTS.map(buildPreview);
  const persistedHistory = previews.map((preview) => pushHistory(createExecutionRecord(preview.plan)));
  const history = persistedHistory.at(-1) ?? loadHistory();
  const exportedPlans = exportPlanSet(previews.map((preview) => preview.plan));
  const providerSummary = providerStatus(config.providers);

  const previewMarkup = previews
    .map((preview) => {
      const destination = createPhase3DestinationPlan(preview.plan, "webdav");
      const request = buildProviderRequest(preview.parsed, config.providers);
      const warningText = preview.plan.warnings.length ? preview.plan.warnings.join("; ") : "none";

      return `
        <article>
          <h3>${escapeHtml(preview.input)}</h3>
          <p><strong>Detected:</strong> ${escapeHtml(preview.candidate.displayName)} (${preview.candidate.score}%)</p>
          <p><strong>Kind:</strong> ${escapeHtml(preview.parsed.kind)}</p>
          <p><strong>Title:</strong> ${escapeHtml(preview.parsed.title)}</p>
          <p><strong>Proposed path:</strong> ${escapeHtml(preview.plan.proposedPath)}</p>
          <p><strong>Warnings:</strong> ${escapeHtml(warningText)}</p>
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

function buildPreview(input: string): PreviewResult {
  const parsed = parseFilename(input);
  const candidate = rankCandidates(parsed)[0];
  const plan = buildPlan(parsed, candidate);
  return { input, parsed, candidate, plan };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
