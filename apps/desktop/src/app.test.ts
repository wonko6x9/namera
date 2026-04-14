import { describe, expect, it } from "vitest";
import { parseFilename } from "@namera/parse";
import { rankCandidates } from "@namera/match";
import { buildPlan } from "@namera/plan";

describe("Namera MVP flow", () => {
  it("builds a movie rename preview", () => {
    const parsed = parseFilename("The.Matrix.1999.1080p.BluRay.mkv");
    const candidate = rankCandidates(parsed)[0];
    const plan = buildPlan(parsed, candidate);

    expect(parsed.title).toBe("The Matrix");
    expect(candidate.displayName).toBe("The Matrix (1999)");
    expect(plan.proposedPath).toBe("Movies/The Matrix (1999)/The Matrix (1999).mkv");
  });

  it("builds a tv rename preview", () => {
    const parsed = parseFilename("Severance.S01E01.Good.News.About.Hell.2160p.WEB-DL.mkv");
    const candidate = rankCandidates(parsed)[0];
    const plan = buildPlan(parsed, candidate);

    expect(parsed.kind).toBe("episode");
    expect(plan.proposedPath).toContain("TV Shows/");
    expect(plan.proposedPath).toContain("S01E01");
  });
});
