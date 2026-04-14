import { describe, expect, it } from "vitest";
import { parseFilename } from "@namera/parse";
import { rankCandidates } from "@namera/match";
import { buildPlan } from "@namera/plan";
import { createPhase3DestinationPlan } from "@namera/destination";
import { buildProviderRequest, providerStatus } from "@namera/provider";
import { createExecutionBatch, createPlannedExecutions, exportPlanSet, summarizeExecutionActions } from "@namera/exec";
import { looksLikeMediaFile, parseTextIngest } from "@namera/ingest";
import { buildPreview, createAppController, summarizeIngest } from "./App";
import { loadConfig } from "@namera/config";

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
    expect(parsed.episode?.seriesTitle).toBe("Severance");
    expect(parsed.episode?.episodeTitle).toBe("Good News About Hell");
    expect(plan.proposedPath).toBe("TV Shows/Severance/Season 01/Severance - S01E01 - Good News About Hell.mkv");
    expect(candidate.reason).toContain("episode title");
  });

  it("exposes a phase 3 destination stub without pretending it works", () => {
    const parsed = parseFilename("The.Matrix.1999.1080p.BluRay.mkv");
    const candidate = rankCandidates(parsed)[0];
    const plan = buildPlan(parsed, candidate);
    const destination = createPhase3DestinationPlan(plan, "webdav");

    expect(destination.backend).toBe("webdav");
    expect(destination.status).toBe("stub");
  });

  it("parses newline-separated ingest input for the preview lane", () => {
    const items = parseTextIngest("The.Matrix.1999.1080p.BluRay.mkv\n\nAndor__S01E03---Reckoning..WEBRip.mp4");

    expect(items).toHaveLength(2);
    expect(items[0]?.name).toBe("The.Matrix.1999.1080p.BluRay.mkv");
    expect(summarizeIngest(items)).toBe("2 inputs ingested");
  });

  it("filters obvious non-media names for file picker ingest", () => {
    expect(looksLikeMediaFile("movie.mkv")).toBe(true);
    expect(looksLikeMediaFile("cover.jpg")).toBe(false);
    expect(looksLikeMediaFile("notes.txt")).toBe(false);
  });

  it("prefers live provider candidates over local heuristics when available", () => {
    const preview = buildPreview("The.Matrix.1999.1080p.BluRay.mkv", [
      {
        provider: "omdb",
        providerId: "tt0133093",
        score: 97,
        displayName: "The Matrix (1999)",
        reason: "Live OMDb match by exact title and year",
      },
    ]);

    expect(preview.candidate.provider).toBe("omdb");
    expect(preview.candidate.confidenceLabel).toBe("high");
    expect(preview.plan.proposedPath).toBe("Movies/The Matrix (1999)/The Matrix (1999).mkv");
  });

  it("allows manual candidate override by index", () => {
    const preview = buildPreview(
      "The.Matrix.1999.1080p.BluRay.mkv",
      [
        {
          provider: "omdb",
          providerId: "tt0133093",
          score: 97,
          displayName: "The Matrix (1999)",
          reason: "Live OMDb match by exact title and year",
        },
        {
          provider: "omdb",
          providerId: "tt0234215",
          score: 74,
          displayName: "The Matrix Reloaded (2003)",
          reason: "Live OMDb candidate from title search",
        },
      ],
      "omdb:tt0234215",
    );

    expect(preview.candidate.displayName).toBe("The Matrix Reloaded (2003)");
    expect(preview.plan.proposedPath).toBe("Movies/The Matrix Reloaded (2003)/The Matrix Reloaded (2003).mkv");
  });

  it("creates an actionable execution plan scaffold from a preview", () => {
    const preview = buildPreview("The.Matrix.1999.1080p.BluRay.mkv");
    const actions = createPlannedExecutions(preview.plan);
    const batch = createExecutionBatch(preview.plan, "dry-run");

    expect(actions).toHaveLength(2);
    expect(actions[0]?.type).toBe("mkdir");
    expect(actions[1]?.type).toBe("rename");
    expect(summarizeExecutionActions(actions)).toContain("rename:Movies/The Matrix (1999)/The Matrix (1999).mkv");
    expect(batch.summary).toBe("Would run 2 actions");
  });

  it("persists config updates through the controller", () => {
    const renders: string[] = [];
    const controller = createAppController((markup) => renders.push(markup));

    controller.updateConfig({
      destinations: {
        movieRoot: "Films",
        tvRoot: "Series",
        musicRoot: "Tracks",
      },
      providers: {
        omdbApiKey: "test-key",
      },
    });

    const config = loadConfig();
    expect(config.destinations.movieRoot).toBe("Films");
    expect(config.providers.omdbApiKey).toBe("test-key");
    expect(renders.at(-1)).toContain("Configuration");
  });

  it("exposes a controller for live-provider refresh flow", async () => {
    const renders: string[] = [];
    const controller = createAppController((markup) => renders.push(markup));

    await controller.refreshProviders();
    controller.chooseCandidate("The.Matrix.1999.1080p.BluRay.mkv", "local-heuristic:The Matrix (1999)");

    expect(renders.at(-1)).toContain("Candidate override");
  });

  it("shapes episode provider requests around the series title", () => {
    const parsed = parseFilename("Severance.S01E01.Good.News.About.Hell.2160p.WEB-DL.mkv");
    const request = buildProviderRequest(parsed, { omdbApiKey: "x" });

    expect(parsed.episode?.seriesTitle).toBe("Severance");
    expect(request.title).toBe("Severance");
    expect(request.season).toBe(1);
    expect(request.episode).toBe(1);
  });

  it("labels low-confidence fallback candidates honestly", () => {
    const parsed = parseFilename("Some.Confusing.File.Name.Thing.bin");
    const candidate = rankCandidates(parsed)[0];

    expect(candidate?.confidenceLabel).toBe("low");
  });

  it("exports plan sets and reports provider status honestly", () => {
    const parsed = parseFilename("The.Matrix.1999.1080p.BluRay.mkv");
    const candidate = rankCandidates(parsed)[0];
    const plan = buildPlan(parsed, candidate);

    expect(exportPlanSet([plan])).toContain("The Matrix");
    expect(providerStatus({})).toContain("No live metadata providers configured yet");
  });
});
