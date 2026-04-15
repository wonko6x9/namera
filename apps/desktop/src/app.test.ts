import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseFilename } from "@namera/parse";
import { buildCorrectionKey, rankCandidates } from "@namera/match";
import { buildPlan } from "@namera/plan";
import { createPhase3DestinationPlan } from "@namera/destination";
import { buildProviderCacheKey, buildProviderRequest, fetchProviderCandidates, fetchProviderLookup, providerStatus } from "@namera/provider";
import { createExecutionBatch, createPlannedExecutions, exportPlanSet, listExecutionLog, summarizeExecutionActions } from "@namera/exec";
import { looksLikeMediaFile, parseTextIngest } from "@namera/ingest";
import { buildPreview, createAppController, summarizeIngest, summarizeReview } from "./App";
import { getCorrection, loadConfig, loadExecutionLog, pushExecutionLog } from "@namera/config";

describe("Namera MVP flow", () => {
  beforeEach(() => {
    if (typeof localStorage !== "undefined") {
      localStorage.clear();
    }
  });
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

  it("trims movie edition and part-disc junk out of the core title", () => {
    const parsed = parseFilename("Blade.Runner.Final.Cut.2007.1080p.BluRay.Part.1.mkv");

    expect(parsed.kind).toBe("movie");
    expect(parsed.title).toBe("Blade Runner Final Cut");
    expect(parsed.movie?.year).toBe(2007);
  });

  it("parses multi-episode markers without polluting the series title", () => {
    const parsed = parseFilename("Battlestar.Galactica.S01E01E02.33.and.Water.1080p.BluRay.mkv");

    expect(parsed.kind).toBe("episode");
    expect(parsed.episode?.seriesTitle).toBe("Battlestar Galactica");
    expect(parsed.episode?.season).toBe(1);
    expect(parsed.episode?.episode).toBe(1);
    expect(parsed.episode?.episodeTitle).toBe("33 And Water");
  });

  it("handles broader real-world filename garbage without manual retyping", () => {
    const samples = [
      {
        input: "The.Lord.of.the.Rings.The.Return.of.the.King.Extended.Edition.2003.2160p.UHD.BluRay.x265.mkv",
        title: "The Lord Of The Rings The Return Of The King Extended Edition",
        kind: "movie",
      },
      {
        input: "Star.Trek.The.Next.Generation.S02E01E02.The.Child.Where.Silence.Has.Lease.1080p.BluRay.mkv",
        seriesTitle: "Star Trek The Next Generation",
        episodeTitle: "The Child Where Silence Has Lease",
        kind: "episode",
      },
      {
        input: "Dune.Part.Two.2024.2160p.WEB-DL.DDP5.1.Atmos.mkv",
        title: "Dune Part Two",
        kind: "movie",
      },
      {
        input: "Andor.S01E10.One.Way.Out.REPACK.1080p.WEB-DL.mkv",
        seriesTitle: "Andor",
        episodeTitle: "One Way Out",
        kind: "episode",
      },
    ] as const;

    for (const sample of samples) {
      const parsed = parseFilename(sample.input);
      expect(parsed.kind).toBe(sample.kind);
      if (sample.kind === "movie") {
        expect(parsed.title).toBe(sample.title);
      } else {
        expect(parsed.episode?.seriesTitle).toBe(sample.seriesTitle);
        expect(parsed.episode?.episodeTitle).toBe(sample.episodeTitle);
      }
    }
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

  it("records apply and undo batches in the execution log scaffold", () => {
    const preview = buildPreview("The.Matrix.1999.1080p.BluRay.mkv");
    const applyBatch = createExecutionBatch(preview.plan, "apply");
    pushExecutionLog(applyBatch.logEntry!);
    const undoBatch = createExecutionBatch(preview.plan, "undo");

    expect(applyBatch.logEntry?.mode).toBe("apply");
    expect(undoBatch.logEntry?.mode).toBe("undo");
    expect(loadExecutionLog().length).toBeGreaterThan(0);
    expect(listExecutionLog()[0]?.proposedPath).toContain("The Matrix");
  });

  it("uses configured destination roots in generated plans", () => {
    const preview = buildPreview(
      "The.Matrix.1999.1080p.BluRay.mkv",
      [],
      undefined,
      {
        destinations: {
          movieRoot: "Films",
          tvRoot: "Series",
          musicRoot: "Tracks",
        },
        providers: {},
      },
    );

    expect(preview.plan.proposedPath).toBe("Films/The Matrix (1999)/The Matrix (1999).mkv");
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

  it("remembers manual candidate corrections for future ranking", () => {
    const renders: string[] = [];
    const controller = createAppController((markup) => renders.push(markup));
    const input = "The.Matrix.1999.1080p.BluRay.mkv";
    const parsed = parseFilename(input);
    const correctionKey = buildCorrectionKey(parsed);

    controller.rememberCandidateChoice(input, "local-heuristic:The Matrix (1999)");

    expect(getCorrection(correctionKey)?.candidateKey).toBe("local-heuristic:The Matrix (1999)");
    expect(renders.at(-1)).toContain("Remembered corrections");
  });

  it("summarizes batch review state for triage", () => {
    const previews = [
      buildPreview("The.Matrix.1999.1080p.BluRay.mkv"),
      buildPreview("Some.Confusing.File.Name.Thing.bin"),
    ];

    const summary = summarizeReview(previews);
    expect(summary.total).toBe(2);
    expect(summary.lowConfidence).toBeGreaterThan(0);
    expect(summary.heuristicOnly).toBe(2);
  });

  it("updates the review filter through the controller", () => {
    const renders: string[] = [];
    const controller = createAppController((markup) => renders.push(markup));

    controller.setReviewFilter("needs-review");

    expect(renders.at(-1)).toContain("Current filter:</strong> needs-review");
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

  it("deduplicates equivalent provider and heuristic candidates", () => {
    const parsed = parseFilename("The.Matrix.1999.1080p.BluRay.mkv");
    const candidates = rankCandidates(parsed, [
      {
        provider: "omdb",
        providerId: "tt0133093",
        score: 92,
        displayName: "The Matrix (1999)",
        reason: "Live OMDb match by exact title and year",
      },
    ]);

    expect(candidates.filter((candidate) => candidate.displayName === "The Matrix (1999)")).toHaveLength(1);
    expect(candidates[0]?.provider).toBe("omdb");
  });

  it("exports plan sets and reports provider status honestly", () => {
    const parsed = parseFilename("The.Matrix.1999.1080p.BluRay.mkv");
    const candidate = rankCandidates(parsed)[0];
    const plan = buildPlan(parsed, candidate);

    expect(exportPlanSet([plan])).toContain("The Matrix");
    expect(providerStatus({})).toContain("No live metadata providers configured yet");
  });

  it("builds deterministic provider cache keys", () => {
    const parsed = parseFilename("The.Matrix.1999.1080p.BluRay.mkv");
    const key = buildProviderCacheKey(parsed);

    expect(key).toContain("movie|the matrix|1999");
  });

  it("surfaces provider diagnostics for missing config and failures", async () => {
    const parsed = parseFilename("The.Matrix.1999.1080p.BluRay.mkv");
    const idle = await fetchProviderLookup(parsed, {});
    const failed = await fetchProviderLookup(
      parsed,
      { omdbApiKey: "x" },
      vi.fn(async () => {
        throw new Error("network down");
      }) as unknown as typeof fetch,
    );

    expect(idle.diagnostics[0]?.status).toBe("idle");
    expect(failed.diagnostics[0]?.status).toBe("error");
    expect(failed.diagnostics[0]?.detail).toContain("network down");
  });

  it("reuses cached provider results before network fetch", async () => {
    const parsed = parseFilename("The.Matrix.1999.1080p.BluRay.mkv");
    const key = buildProviderCacheKey(parsed);
    const payload = JSON.stringify([
      {
        provider: "omdb",
        providerId: "tt0133093",
        score: 98,
        displayName: "The Matrix (1999)",
        reason: "Live OMDb match by exact title and year",
      },
    ]);

    const storage = {
      getItem: (name: string) => (name === "namera.provider-cache" ? JSON.stringify({ [key]: payload }) : null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      key: vi.fn(),
      length: 1,
    } as unknown as Storage;

    Object.defineProperty(globalThis, "localStorage", {
      value: storage,
      configurable: true,
    });

    const fetchMock = vi.fn();
    const first = await fetchProviderCandidates(parsed, { omdbApiKey: "x" }, fetchMock as unknown as typeof fetch);
    const second = await fetchProviderCandidates(parsed, { omdbApiKey: "x" }, fetchMock as unknown as typeof fetch);

    expect(first[0]?.displayName).toBe("The Matrix (1999)");
    expect(second[0]?.displayName).toBe("The Matrix (1999)");
    expect(fetchMock).toHaveBeenCalledTimes(0);
  });
});
