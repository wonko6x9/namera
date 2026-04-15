import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NativeExecutionBatch } from "./tauri";
import { parseFilename } from "@namera/parse";
import { buildCorrectionKey, rankCandidates } from "@namera/match";
import { buildPlan } from "@namera/plan";
import { createPhase3DestinationPlan, createPhase3TransferPlan } from "@namera/destination";
import { buildProviderCacheKey, buildProviderRequest, fetchProviderCandidates, fetchProviderLookup, providerStatus } from "@namera/provider";
import { createExecutionBatch, createPlannedExecutions, exportPlanSet, exportReviewPlanSet, listExecutionLog, summarizeExecutionActions } from "@namera/exec";
import { looksLikeMediaFile, parseTextIngest } from "@namera/ingest";
import { buildArtworkSearchUrl, buildMediaSearchUrl, buildPreview, createAppController, exportFailedBatchResults, resetAppState, summarizeIngest, summarizeReview } from "./App";
import { getCorrection, loadConfig, loadExecutionLog, loadRecentIngestRoots, pushExecutionLog } from "@namera/config";

describe("Namera MVP flow", () => {
  beforeEach(() => {
    if (typeof localStorage !== "undefined") {
      localStorage.clear();
    }
    resetAppState();
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

  it("routes audio files into the music lane", () => {
    const parsed = parseFilename("Daft.Punk.Harder.Better.Faster.Stronger.mp3");
    const candidate = rankCandidates(parsed)[0];
    const plan = buildPlan(parsed, candidate);

    expect(parsed.kind).toBe("music");
    expect(plan.proposedPath).toBe("Music/Daft Punk Harder Better Faster Stronger.mp3");
  });

  it("preserves language qualifiers on movie subtitle sidecars", () => {
    const parsed = parseFilename("The.Matrix.1999.en.forced.srt");
    const candidate = rankCandidates(parsed)[0];
    const plan = buildPlan(parsed, candidate);

    expect(parsed.qualifierSuffix).toBe(".en.forced");
    expect(plan.proposedPath).toBe("Movies/The Matrix (1999)/The Matrix (1999).en.forced.srt");
  });

  it("preserves language qualifiers on episode subtitle sidecars", () => {
    const parsed = parseFilename("Severance.S01E01.Good.News.About.Hell.es.sdh.ass");
    const candidate = rankCandidates(parsed)[0];
    const plan = buildPlan(parsed, candidate);

    expect(parsed.qualifierSuffix).toBe(".es.sdh");
    expect(plan.proposedPath).toBe("TV Shows/Severance/Season 01/Severance - S01E01 - Good News About Hell.es.sdh.ass");
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
    const destination = createPhase3DestinationPlan(plan, parsed.kind, undefined, "webdav");

    expect(destination.backend).toBe("webdav");
    expect(destination.status).toBe("stub");
  });

  it("builds a phase 3 WebDAV target path per media type when configured", () => {
    const parsed = parseFilename("The.Matrix.1999.1080p.BluRay.mkv");
    const candidate = rankCandidates(parsed)[0];
    const plan = buildPlan(parsed, candidate);
    const destination = createPhase3DestinationPlan(
      plan,
      parsed.kind,
      {
        movieRoot: "Movies",
        tvRoot: "TV Shows",
        musicRoot: "Music",
        webdavMovieRoot: "/remote/movies",
      },
      "webdav",
    );

    expect(destination.status).toBe("ready");
    expect(destination.targetPath).toBe("/remote/movies/The Matrix (1999)/The Matrix (1999).mkv");
  });

  it("builds a blocked or planned phase 3 transfer contract honestly", () => {
    const parsed = parseFilename("The.Matrix.1999.1080p.BluRay.mkv");
    const candidate = rankCandidates(parsed)[0];
    const plan = buildPlan(parsed, candidate);

    const blocked = createPhase3TransferPlan(plan, parsed.kind, undefined);
    expect(blocked.status).toBe("blocked");
    expect(blocked.summary).toContain("no WebDAV root");

    const planned = createPhase3TransferPlan(plan, parsed.kind, {
      movieRoot: "Movies",
      tvRoot: "TV Shows",
      musicRoot: "Music",
      webdavMovieRoot: "/remote/movies",
    });
    expect(planned.status).toBe("planned");
    expect(planned.actions[1]).toContain("/remote/movies/The Matrix (1999)/The Matrix (1999).mkv");
  });

  it("parses newline-separated ingest input for the preview lane", () => {
    const items = parseTextIngest("The.Matrix.1999.1080p.BluRay.mkv\n\nAndor__S01E03---Reckoning..WEBRip.mp4");

    expect(items).toHaveLength(2);
    expect(items[0]?.name).toBe("The.Matrix.1999.1080p.BluRay.mkv");
    expect(summarizeIngest(items)).toBe("2 inputs ingested");
  });

  it("filters obvious non-media names for file picker ingest", () => {
    expect(looksLikeMediaFile("movie.mkv")).toBe(true);
    expect(looksLikeMediaFile("movie.en.srt")).toBe(true);
    expect(looksLikeMediaFile("cover.jpg")).toBe(false);
    expect(looksLikeMediaFile("notes.txt")).toBe(false);
  });

  it("advertises subtitle sidecars in the file picker accept list", async () => {
    const { App } = await import("./App");

    expect(App()).toContain('accept=".mkv,.mp4,.avi,.mov,.m4v,.mp3,.flac,.wav,.srt,.ass,.ssa,.vtt,.sub,.idx"');
  });

  it("exposes queue cleanup controls in ingest markup", async () => {
    const { App } = await import("./App");

    expect(App()).toContain('data-role="clear-ingest"');
    expect(App()).toContain('data-role="remove-ingest-item"');
  });

  it("exposes preview backend toggle controls", async () => {
    const { App } = await import("./App");

    expect(App()).toContain('data-role="preview-backend-local"');
    expect(App()).toContain('data-role="preview-backend-webdav"');
    expect(App()).toContain('data-role="filter-webdav-ready"');
    expect(App()).toContain('data-role="filter-webdav-blocked"');
    expect(App()).toContain("Destination preview mode:</strong> local");
    expect(App()).toContain("WebDAV transfer readiness:</strong>");
  });

  it("builds useful manual search URLs for movies and TV", () => {
    const movie = parseFilename("The.Matrix.1999.1080p.BluRay.mkv");
    const episode = parseFilename("Severance.S01E01.Good.News.About.Hell.2160p.WEB-DL.mkv");

    expect(buildMediaSearchUrl(movie, loadConfig())).toContain("imdb.com/find/");
    expect(buildMediaSearchUrl(episode, loadConfig())).toContain("tvmaze.com/search");
    expect(decodeURIComponent(buildArtworkSearchUrl(movie))).toContain("movie poster dvd cover");
    expect(decodeURIComponent(buildArtworkSearchUrl(episode))).toContain("Severance season 1 poster");
  });

  it("exports failed batch items as structured JSON", () => {
    const exported = exportFailedBatchResults([
      { input: "ok.mkv", outcome: "applied", summary: "Applied 2 actions" },
      { input: "bad.mkv", outcome: "failed", summary: "boom" },
    ]);

    expect(exported).toContain('"input": "bad.mkv"');
    expect(exported).toContain('"summary": "boom"');
    expect(exportFailedBatchResults([])).toBe("");
  });

  it("allows manual search providers to be configured per media type", () => {
    const movie = parseFilename("The.Matrix.1999.1080p.BluRay.mkv");
    const episode = parseFilename("Severance.S01E01.Good.News.About.Hell.2160p.WEB-DL.mkv");
    const music = parseFilename("Daft.Punk.Harder.Better.Faster.Stronger.mp3");

    const config = {
      destinations: loadConfig().destinations,
      providers: {
        movieSearchProvider: "google" as const,
        tvSearchProvider: "google" as const,
        musicSearchProvider: "google" as const,
      },
    };

    expect(buildMediaSearchUrl(movie, config)).toContain("google.com/search");
    expect(buildMediaSearchUrl(episode, config)).toContain("google.com/search");
    expect(buildMediaSearchUrl(music, config)).toContain("google.com/search");
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
          sourceRoot: "/incoming",
          targetRoot: "/library",
          collisionPolicy: "rename-new",
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
        sourceRoot: "/incoming",
        targetRoot: "/library",
        webdavMovieRoot: "/dav/movies",
        webdavTvRoot: "/dav/tv",
        webdavMusicRoot: "/dav/music",
        collisionPolicy: "overwrite",
      },
      providers: {
        omdbApiKey: "test-key",
        movieSearchProvider: "google",
        tvSearchProvider: "google",
        musicSearchProvider: "google",
      },
    });

    const config = loadConfig();
    expect(config.destinations.movieRoot).toBe("Films");
    expect(config.destinations.sourceRoot).toBe("/incoming");
    expect(config.destinations.targetRoot).toBe("/library");
    expect(config.destinations.webdavMovieRoot).toBe("/dav/movies");
    expect(config.destinations.webdavTvRoot).toBe("/dav/tv");
    expect(config.destinations.webdavMusicRoot).toBe("/dav/music");
    expect(config.destinations.collisionPolicy).toBe("overwrite");
    expect(config.providers.omdbApiKey).toBe("test-key");
    expect(config.providers.movieSearchProvider).toBe("google");
    expect(config.providers.tvSearchProvider).toBe("google");
    expect(config.providers.musicSearchProvider).toBe("google");
    expect(renders.at(-1)).toContain("Configuration");
  });

  it("remembers recent ingest roots from file and folder picks", async () => {
    const renders: string[] = [];
    const controller = createAppController((markup) => renders.push(markup));
    const files = [
      { name: "The.Matrix.1999.1080p.BluRay.mkv", size: 1, webkitRelativePath: "incoming/movies/The.Matrix.1999.1080p.BluRay.mkv" },
      { name: "Severance.S01E01.Good.News.About.Hell.2160p.WEB-DL.mkv", size: 1, webkitRelativePath: "incoming/tv/Severance.S01E01.Good.News.About.Hell.2160p.WEB-DL.mkv" },
    ] as File[];

    await controller.ingestFiles(files);

    expect(loadRecentIngestRoots()).toEqual(["incoming/movies", "incoming/tv"]);
    expect(renders.at(-1)).toContain("Recent ingest roots");
    expect(renders.at(-1)).toContain("incoming/movies");
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

  it("switches destination preview backend through the controller", () => {
    const renders: string[] = [];
    const controller = createAppController((markup) => renders.push(markup));

    controller.setPreviewDestinationBackend("webdav");

    expect(renders.at(-1)).toContain("Destination preview mode:</strong> webdav");
    expect(renders.at(-1)).toContain("WebDAV transfer readiness:</strong>");
    expect(renders.at(-1)).toContain("Phase 3 transfer:</strong>");
    expect(renders.at(-1)).toContain("Exported review plan set");
    expect(renders.at(-1)).toContain("Exported visible review plan set");
    expect(renders.at(-1)).toContain('&quot;backend&quot;: &quot;webdav&quot;');

    controller.setPreviewDestinationBackend("local");

    expect(renders.at(-1)).toContain("Destination preview mode:</strong> local");
    expect(renders.at(-1)).toContain("WebDAV transfer readiness:</strong>");
    expect(renders.at(-1)).toContain("Not needed for local destination preview.");
    expect(renders.at(-1)).toContain('&quot;backend&quot;: &quot;local&quot;');
  });

  it("removes a single ingest item from the queue", () => {
    const renders: string[] = [];
    const controller = createAppController((markup) => renders.push(markup));

    controller.removeIngestItem("The.Matrix.1999.1080p.BluRay.mkv");

    expect(renders.at(-1)).not.toContain("The.Matrix.1999.1080p.BluRay.mkv</h3>");
    expect(renders.at(-1)).toContain("Severance.S01E01.Good.News.About.Hell.2160p.WEB-DL.mkv</h3>");
  });

  it("clears the ingest queue through the controller", () => {
    const renders: string[] = [];
    const controller = createAppController((markup) => renders.push(markup));

    controller.clearIngestedItems();

    expect(renders.at(-1)).toContain("No inputs ingested");
    expect(renders.at(-1)).toContain("No items match the current review filter.");
    expect(renders.at(-1)).toContain("Queue cleared");
  });

  it("can focus the review lane on previously failed batch items", async () => {
    const renders: string[] = [];
    const controller = createAppController((markup) => renders.push(markup));
    controller.setReviewFilter("all");
    const invoke = vi
      .fn()
      .mockImplementationOnce(async () => ({
        mode: "apply",
        summary: "Applied 2 actions",
        actions: [{ action_type: "rename", to_path: "Movies/The Matrix (1999)/The Matrix (1999).mkv", status: "applied" }],
        log_entry: null,
      }))
      .mockRejectedValueOnce(new Error("boom"))
      .mockImplementationOnce(async () => ({
        mode: "apply",
        summary: "Skipped apply because destination already exists",
        actions: [{ action_type: "rename", to_path: "TV Shows/Andor/Season 01/Andor - S01E03 - Reckoning.mp4", status: "skipped" }],
        log_entry: null,
      }))
      .mockImplementationOnce(async () => ({
        mode: "apply",
        summary: "Skipped apply because destination already exists",
        actions: [{ action_type: "rename", to_path: "Unsorted/Some Confusing File Name Thing.bin", status: "skipped" }],
        log_entry: null,
      }));

    Object.defineProperty(globalThis, "window", {
      value: { __TAURI__: { core: { invoke } } },
      configurable: true,
    });

    await controller.applyVisibleNativeBatch();
    controller.setReviewFilter("failed-batch");

    expect(renders.at(-1)).toContain("Current filter:</strong> failed-batch");
    expect(renders.at(-1)).toContain("Severance.S01E01.Good.News.About.Hell.2160p.WEB-DL.mkv");
    expect(renders.at(-1)).not.toContain("The.Matrix.1999.1080p.BluRay.mkv</h3>");
  });

  it("records native apply results through the controller when Tauri is available", async () => {
    const renders: string[] = [];
    const controller = createAppController((markup) => renders.push(markup));
    const invoke = vi.fn(async () => ({
      mode: "apply",
      summary: "Applied 2 actions",
      actions: [
        { action_type: "mkdir", to_path: "Movies/The Matrix (1999)", status: "applied", note: "ok" },
        { action_type: "rename", from_path: "The.Matrix.1999.1080p.BluRay.mkv", to_path: "Movies/The Matrix (1999)/The Matrix (1999).mkv", status: "applied", note: "ok" },
      ],
      log_entry: {
        id: "test-id",
        mode: "apply",
        source_name: "The.Matrix.1999.1080p.BluRay.mkv",
        proposed_path: "Movies/The Matrix (1999)/The Matrix (1999).mkv",
        created_at: "1Z",
        source_size_bytes: 6,
        actions: [],
      },
    } satisfies NativeExecutionBatch));

    const fakeWindow = { __TAURI__: { core: { invoke } } };
    Object.defineProperty(globalThis, "window", {
      value: fakeWindow,
      configurable: true,
    });

    await controller.applyNativeExecution("The.Matrix.1999.1080p.BluRay.mkv");

    expect(invoke).toHaveBeenCalledWith(
      "apply_execution_batch_command",
      expect.objectContaining({
        collisionPolicy: expect.stringMatching(/^(skip|overwrite|rename-new)$/),
        sourceRoot: expect.any(String),
        targetRoot: expect.any(String),
      }),
    );
    expect(loadExecutionLog()[0]?.mode).toBe("apply");
    expect(loadExecutionLog()[0]?.sourceSizeBytes).toBe(6);
    expect(renders.at(-1)).toContain("Applied 2 actions");
  });

  it("marks the matching apply record undone after a successful native undo", async () => {
    const renders: string[] = [];
    const controller = createAppController((markup) => renders.push(markup));

    pushExecutionLog({
      id: "apply-1",
      mode: "apply",
      sourceName: "The.Matrix.1999.1080p.BluRay.mkv",
      proposedPath: "/library/Movies/The Matrix (1999)/The Matrix (1999).mkv",
      createdAt: "1Z",
      sourceSizeBytes: 6,
      actions: [],
    });

    const invoke = vi.fn(async () => ({
      mode: "undo",
      summary: "Undid 1 action",
      actions: [
        { action_type: "rename", from_path: "/library/Movies/The Matrix (1999)/The Matrix (1999).mkv", to_path: "/incoming/The.Matrix.1999.1080p.BluRay.mkv", status: "reverted", note: "ok" },
      ],
      log_entry: {
        id: "undo-1",
        mode: "undo",
        source_name: "The.Matrix.1999.1080p.BluRay.mkv",
        proposed_path: "/library/Movies/The Matrix (1999)/The Matrix (1999).mkv",
        created_at: "2Z",
        apply_log_id: "apply-1",
        source_size_bytes: 6,
        undone_at: "2Z",
        actions: [],
      },
    } satisfies NativeExecutionBatch));

    const fakeWindow = { __TAURI__: { core: { invoke } } };
    Object.defineProperty(globalThis, "window", {
      value: fakeWindow,
      configurable: true,
    });

    await controller.undoNativeExecution("The.Matrix.1999.1080p.BluRay.mkv");

    const [undoEntry, applyEntry] = loadExecutionLog();
    expect(invoke).toHaveBeenCalledWith(
      "undo_execution_batch_command",
      expect.objectContaining({ expectedLogId: "apply-1", expectedSizeBytes: 6, appliedPath: "/library/Movies/The Matrix (1999)/The Matrix (1999).mkv" }),
    );
    expect(undoEntry?.mode).toBe("undo");
    expect(applyEntry?.undoneAt).toBeTruthy();
    expect(renders.at(-1)).toContain("Undid 1 action");
  });

  it("applies the visible batch sequentially and summarizes partial failures", async () => {
    const renders: string[] = [];
    const controller = createAppController((markup) => renders.push(markup));
    controller.setReviewFilter("all");
    const invoke = vi
      .fn()
      .mockImplementationOnce(async () => ({
        mode: "apply",
        summary: "Applied 2 actions",
        actions: [{ action_type: "rename", to_path: "Movies/The Matrix (1999)/The Matrix (1999).mkv", status: "applied" }],
        log_entry: {
          id: "apply-1",
          mode: "apply",
          source_name: "The.Matrix.1999.1080p.BluRay.mkv",
          proposed_path: "Movies/The Matrix (1999)/The Matrix (1999).mkv",
          created_at: "1Z",
          actions: [],
        },
      }))
      .mockRejectedValueOnce(new Error("boom"))
      .mockImplementationOnce(async () => ({
        mode: "apply",
        summary: "Skipped apply because destination already exists",
        actions: [{ action_type: "rename", to_path: "TV Shows/Andor/Season 01/Andor - S01E03 - Reckoning.mp4", status: "skipped" }],
        log_entry: null,
      }))
      .mockImplementationOnce(async () => ({
        mode: "apply",
        summary: "Skipped apply because destination already exists",
        actions: [{ action_type: "rename", to_path: "Unsorted/Some Confusing File Name Thing.bin", status: "skipped" }],
        log_entry: null,
      }));

    const fakeWindow = { __TAURI__: { core: { invoke } } };
    Object.defineProperty(globalThis, "window", {
      value: fakeWindow,
      configurable: true,
    });

    await controller.applyVisibleNativeBatch();

    expect(invoke).toHaveBeenCalledTimes(4);
    expect(renders.at(-1)).toContain("Batch apply finished: 1 applied, 2 skipped, 1 failed");
    expect(renders.at(-1)).toContain("<strong>applied:</strong> The.Matrix.1999.1080p.BluRay.mkv");
    expect(renders.at(-1)).toContain("<strong>failed:</strong> Severance.S01E01.Good.News.About.Hell.2160p.WEB-DL.mkv");
    expect(renders.at(-1)).toContain("<strong>skipped:</strong> Andor__S01E03---Reckoning..WEBRip.mp4");
    expect(renders.at(-1)).toContain('&quot;input&quot;: &quot;Severance.S01E01.Good.News.About.Hell.2160p.WEB-DL.mkv&quot;');
  });

  it("retries only previously failed batch items", async () => {
    const renders: string[] = [];
    const controller = createAppController((markup) => renders.push(markup));
    controller.setReviewFilter("all");
    const invoke = vi
      .fn()
      .mockImplementationOnce(async () => ({
        mode: "apply",
        summary: "Applied 2 actions",
        actions: [{ action_type: "rename", to_path: "Movies/The Matrix (1999)/The Matrix (1999).mkv", status: "applied" }],
        log_entry: null,
      }))
      .mockRejectedValueOnce(new Error("boom"))
      .mockImplementationOnce(async () => ({
        mode: "apply",
        summary: "Skipped apply because destination already exists",
        actions: [{ action_type: "rename", to_path: "TV Shows/Andor/Season 01/Andor - S01E03 - Reckoning.mp4", status: "skipped" }],
        log_entry: null,
      }))
      .mockImplementationOnce(async () => ({
        mode: "apply",
        summary: "Skipped apply because destination already exists",
        actions: [{ action_type: "rename", to_path: "Unsorted/Some Confusing File Name Thing.bin", status: "skipped" }],
        log_entry: null,
      }))
      .mockImplementationOnce(async () => ({
        mode: "apply",
        summary: "Applied 2 actions",
        actions: [{ action_type: "rename", to_path: "TV Shows/Severance/Season 01/Severance - S01E01 - Good News About Hell.mkv", status: "applied" }],
        log_entry: null,
      }));

    const fakeWindow = { __TAURI__: { core: { invoke } } };
    Object.defineProperty(globalThis, "window", {
      value: fakeWindow,
      configurable: true,
    });

    await controller.applyVisibleNativeBatch();
    await controller.retryFailedNativeBatch();

    expect(invoke).toHaveBeenCalledTimes(5);
    expect(invoke.mock.calls.at(-1)?.[1]).toMatchObject({ input: "Severance.S01E01.Good.News.About.Hell.2160p.WEB-DL.mkv" });
    expect(renders.at(-1)).toContain("Retry failed batch finished: 1 applied, 0 skipped, 0 failed");
    expect(renders.at(-1)).toContain("<strong>applied:</strong> Severance.S01E01.Good.News.About.Hell.2160p.WEB-DL.mkv");
  });

  it("disables retry failed batch when there is nothing failed to retry", async () => {
    const { App } = await import("./App");

    expect(App()).toContain('data-role="retry-failed-batch" type="button" disabled');
  });

  it("surfaces configured collision policy in preview warnings", () => {
    const preview = buildPreview(
      "The.Matrix.1999.1080p.BluRay.mkv",
      [],
      undefined,
      {
        destinations: {
          movieRoot: "Movies",
          tvRoot: "TV Shows",
          musicRoot: "Music",
          sourceRoot: ".",
          targetRoot: ".",
          collisionPolicy: "rename-new",
        },
        providers: {},
      },
    );

    expect(preview.plan.warnings).toContain("Destination collision policy: rename-new");
  });

  it("shapes episode provider requests around the series title", () => {
    const parsed = parseFilename("Severance.S01E01.Good.News.About.Hell.2160p.WEB-DL.mkv");
    const request = buildProviderRequest(parsed, { omdbApiKey: "x" });

    expect(parsed.episode?.seriesTitle).toBe("Severance");
    expect(request.title).toBe("Severance");
    expect(request.season).toBe(1);
    expect(request.episode).toBe(1);
  });

  it("adds a TV-specific provider lane for episode lookups", async () => {
    const parsed = parseFilename("Foundation.S02E01.In.Seldons.Shadow.2160p.WEB-DL.mkv");
    const fetchMock = vi.fn(async (input: URL | RequestInfo) => {
      const url = String(input);
      if (url.includes("omdbapi.com")) {
        return {
          ok: true,
          json: async () => ({ Response: "False", Error: "Too many results." }),
        } as Response;
      }

      if (url.includes("api.tvmaze.com")) {
        return {
          ok: true,
          json: async () => [
            {
              score: 1,
              show: {
                id: 123,
                name: "Foundation",
                premiered: "2022-02-18",
              },
            },
          ],
        } as Response;
      }

      throw new Error(`unexpected url ${url}`);
    });

    const result = await fetchProviderLookup(parsed, { omdbApiKey: "x" }, fetchMock as unknown as typeof fetch);

    expect(result.candidates.some((candidate) => candidate.provider === "tvmaze")).toBe(true);
    expect(result.diagnostics.map((diagnostic) => `${diagnostic.provider}:${diagnostic.status}`).join(",")).toContain("tvmaze:ok");
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
    const preview = buildPreview("The.Matrix.1999.1080p.BluRay.mkv");

    expect(exportPlanSet([plan])).toContain("The Matrix");
    expect(exportReviewPlanSet([preview], undefined, "local")).toContain('"backend": "local"');
    expect(exportReviewPlanSet([preview], {
      movieRoot: "Movies",
      tvRoot: "TV Shows",
      musicRoot: "Music",
      webdavMovieRoot: "/remote/movies",
    }, "webdav")).toContain('"transferPlan"');
    expect(providerStatus({})).toContain("No live metadata providers configured yet");
  });

  it("summarizes webdav readiness honestly when some roots are configured", () => {
    const renders: string[] = [];
    const controller = createAppController((markup) => renders.push(markup));

    controller.updateConfig({
      destinations: {
        movieRoot: "Movies",
        tvRoot: "TV Shows",
        musicRoot: "Music",
        sourceRoot: ".",
        targetRoot: ".",
        webdavMovieRoot: "/remote/movies",
        webdavTvRoot: "/remote/tv",
        webdavMusicRoot: "",
        collisionPolicy: "skip",
      },
    });

    expect(renders.at(-1)).toContain("WebDAV transfer readiness:</strong> 3 ready, 1 blocked");
  });

  it("filters the review lane by webdav readiness state", () => {
    const renders: string[] = [];
    const controller = createAppController((markup) => renders.push(markup));

    controller.updateConfig({
      destinations: {
        movieRoot: "Movies",
        tvRoot: "TV Shows",
        musicRoot: "Music",
        sourceRoot: ".",
        targetRoot: ".",
        webdavMovieRoot: "/remote/movies",
        webdavTvRoot: "/remote/tv",
        webdavMusicRoot: "",
        collisionPolicy: "skip",
      },
    });
    controller.setReviewFilter("webdav-ready");

    expect(renders.at(-1)).toContain("Current filter:</strong> webdav-ready");
    expect(renders.at(-1)).toContain("The.Matrix.1999.1080p.BluRay.mkv</h3>");
    expect(renders.at(-1)).not.toContain("Some.Confusing.File.Name.Thing.bin</h3>");
    expect(renders.at(-1)).toContain("Exported visible review plan set");
    expect(renders.at(-1)).toContain('&quot;input&quot;: &quot;The.Matrix.1999.1080p.BluRay.mkv&quot;');

    controller.setReviewFilter("webdav-blocked");

    expect(renders.at(-1)).toContain("Current filter:</strong> webdav-blocked");
    expect(renders.at(-1)).toContain("Some.Confusing.File.Name.Thing.bin</h3>");
    expect(renders.at(-1)).not.toContain("The.Matrix.1999.1080p.BluRay.mkv</h3>");
    expect(renders.at(-1)).toContain('&quot;input&quot;: &quot;Some.Confusing.File.Name.Thing.bin&quot;');
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

    expect(idle.diagnostics.some((diagnostic) => diagnostic.status === "idle")).toBe(true);
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
