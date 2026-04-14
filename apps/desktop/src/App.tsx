import { parseFilename } from "@namera/parse";
import { rankCandidates } from "@namera/match";
import { buildPlan } from "@namera/plan";

const SAMPLE_INPUTS = [
  "The.Matrix.1999.1080p.BluRay.mkv",
  "Severance.S01E01.Good.News.About.Hell.2160p.WEB-DL.mkv",
  "Andor__S01E03---Reckoning..WEBRip.mp4",
];

export function App(): string {
  const previews = SAMPLE_INPUTS.map((input) => {
    const parsed = parseFilename(input);
    const candidate = rankCandidates(parsed)[0];
    const plan = buildPlan(parsed, candidate);
    const warningText = plan.warnings.length ? plan.warnings.join("; ") : "none";

    return `
      <article>
        <h3>${escapeHtml(input)}</h3>
        <p><strong>Detected:</strong> ${escapeHtml(candidate.displayName)} (${candidate.score}%)</p>
        <p><strong>Kind:</strong> ${escapeHtml(parsed.kind)}</p>
        <p><strong>Title:</strong> ${escapeHtml(parsed.title)}</p>
        <p><strong>Proposed path:</strong> ${escapeHtml(plan.proposedPath)}</p>
        <p><strong>Warnings:</strong> ${escapeHtml(warningText)}</p>
      </article>
    `;
  }).join("");

  return `
    <main>
      <h1>Namera</h1>
      <p>MVP desktop shell for turning ugly media filenames into previewable rename plans.</p>
      <section>
        <h2>Live sample preview</h2>
        ${previews}
      </section>
    </main>
  `;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
