import { getProviderCacheEntry, setProviderCacheEntry } from "@namera/config";
import type { MatchCandidate, ParsedMedia, ProviderConfig, ProviderDiagnostic } from "@namera/core";

interface ProviderRequest {
  kind: ParsedMedia["kind"];
  title: string;
  year: number | undefined;
  season: number | undefined;
  episode: number | undefined;
  configuredProviders: string[];
}

interface OmdbSearchResponse {
  Search?: Array<{
    imdbID: string;
    Title: string;
    Year: string;
    Type: string;
  }>;
  Response: "True" | "False";
  Error?: string;
}

interface TvmazeSearchResponseItem {
  score: number;
  show: {
    id: number;
    name: string;
    premiered?: string;
    genres?: string[];
  };
}

export interface ProviderLookupResult {
  candidates: MatchCandidate[];
  diagnostics: ProviderDiagnostic[];
}

export function buildProviderRequest(parsed: ParsedMedia, config: ProviderConfig): ProviderRequest {
  return {
    kind: parsed.kind,
    title: parsed.kind === "episode" ? parsed.episode?.seriesTitle ?? parsed.title : parsed.title,
    year: parsed.movie?.year,
    season: parsed.episode?.season,
    episode: parsed.episode?.episode,
    configuredProviders: Object.keys(config).filter((key) => Boolean(config[key as keyof ProviderConfig])),
  };
}

export function providerStatus(config: ProviderConfig): string {
  const keys = Object.entries(config).filter(([, value]) => Boolean(value));
  if (!keys.length) return "No live metadata providers configured yet";
  return `Configured providers: ${keys.map(([name]) => name).join(", ")}`;
}

export async function fetchProviderCandidates(
  parsed: ParsedMedia,
  config: ProviderConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<MatchCandidate[]> {
  const result = await fetchProviderLookup(parsed, config, fetchImpl);
  return result.candidates;
}

export async function fetchProviderLookup(
  parsed: ParsedMedia,
  config: ProviderConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<ProviderLookupResult> {
  if (parsed.kind !== "movie" && parsed.kind !== "episode") {
    return {
      candidates: [],
      diagnostics: [{ provider: "omdb", status: "idle", detail: `No live lookup for kind ${parsed.kind}` }],
    };
  }

  const diagnostics: ProviderDiagnostic[] = [];
  const allCandidates: MatchCandidate[] = [];
  const cacheKey = buildProviderCacheKey(parsed);
  const cached = getProviderCacheEntry(cacheKey);
  if (cached) {
    try {
      const candidates = JSON.parse(cached) as MatchCandidate[];
      if (candidates.length) {
        return {
          candidates,
          diagnostics: [
            {
              provider: "cache",
              status: "ok",
              detail: `Loaded ${candidates.length} cached candidate${candidates.length === 1 ? "" : "s"}`,
              cached: true,
            },
          ],
        };
      }
    } catch {
      // refresh below
    }
  }

  if (config.omdbApiKey) {
    const omdbResult = await fetchOmdbCandidates(parsed, config.omdbApiKey, fetchImpl, cacheKey);
    allCandidates.push(...omdbResult.candidates);
    diagnostics.push(...omdbResult.diagnostics);
  } else {
    diagnostics.push({ provider: "omdb", status: "idle", detail: "OMDb API key not configured" });
  }

  if (parsed.kind === "episode") {
    const tvmazeResult = await fetchTvmazeCandidates(parsed, fetchImpl);
    allCandidates.push(...tvmazeResult.candidates);
    diagnostics.push(...tvmazeResult.diagnostics);
  }

  setProviderCacheEntry(cacheKey, JSON.stringify(allCandidates));
  return {
    candidates: allCandidates,
    diagnostics,
  };
}

export function buildProviderCacheKey(parsed: ParsedMedia): string {
  return [parsed.kind, parsed.title, parsed.movie?.year ?? "", parsed.episode?.season ?? "", parsed.episode?.episode ?? ""]
    .map((part) => String(part).trim().toLowerCase())
    .join("|");
}

async function fetchOmdbCandidates(
  parsed: ParsedMedia,
  omdbApiKey: string,
  fetchImpl: typeof fetch,
  cacheKey: string,
): Promise<ProviderLookupResult> {
  const url = new URL("https://www.omdbapi.com/");
  url.searchParams.set("apikey", omdbApiKey);
  url.searchParams.set("s", parsed.kind === "episode" ? parsed.episode?.seriesTitle ?? parsed.title : parsed.title);

  if (parsed.kind === "movie") {
    url.searchParams.set("type", "movie");
    if (parsed.movie?.year) url.searchParams.set("y", String(parsed.movie.year));
  } else if (parsed.kind === "episode") {
    url.searchParams.set("type", "series");
  }

  let response: Response;
  try {
    response = await fetchImpl(url, {
      headers: {
        Accept: "application/json",
      },
    });
  } catch (error) {
    return {
      candidates: [],
      diagnostics: [
        {
          provider: "omdb",
          status: "error",
          detail: `OMDb request failed: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
    };
  }

  if (!response.ok) {
    return {
      candidates: [],
      diagnostics: [
        {
          provider: "omdb",
          status: "error",
          detail: `OMDb HTTP ${response.status}`,
        },
      ],
    };
  }

  const data = (await response.json()) as OmdbSearchResponse;
  if (data.Response !== "True" || !data.Search?.length) {
    const detail = data.Error ? `OMDb returned no candidates: ${data.Error}` : "OMDb returned no candidates";
    return {
      candidates: [],
      diagnostics: [{ provider: "omdb", status: "empty", detail }],
    };
  }

  const candidates = data.Search.slice(0, 5).map((result, index) => {
    const requestTitle = parsed.kind === "episode" ? parsed.episode?.seriesTitle ?? parsed.title : parsed.title;
    const exactTitle = result.Title.toLowerCase() === requestTitle.toLowerCase();
    const sameYear = parsed.movie?.year ? result.Year.includes(String(parsed.movie.year)) : false;
    const baseScore = parsed.kind === "movie" ? 72 : 68;
    const score = Math.min(98, baseScore + (exactTitle ? 18 : 8) + (sameYear ? 8 : 0) - index * 3);

    return {
      provider: "omdb",
      providerId: result.imdbID,
      score,
      confidenceLabel: score >= 90 ? "high" : score >= 70 ? "medium" : "low",
      displayName: result.Year ? `${result.Title} (${result.Year})` : result.Title,
      reason: exactTitle
        ? sameYear
          ? "Live OMDb match by exact title and year"
          : "Live OMDb match by exact title"
        : "Live OMDb candidate from title search",
    } satisfies MatchCandidate;
  });

  return {
    candidates,
    diagnostics: [
      {
        provider: "omdb",
        status: "ok",
        detail: `OMDb returned ${candidates.length} candidate${candidates.length === 1 ? "" : "s"}`,
      },
    ],
  };
}

async function fetchTvmazeCandidates(parsed: ParsedMedia, fetchImpl: typeof fetch): Promise<ProviderLookupResult> {
  if (parsed.kind !== "episode") {
    return {
      candidates: [],
      diagnostics: [{ provider: "tvmaze", status: "idle", detail: `No TVmaze lookup for kind ${parsed.kind}` }],
    };
  }

  const url = new URL("https://api.tvmaze.com/search/shows");
  url.searchParams.set("q", parsed.episode?.seriesTitle ?? parsed.title);

  let response: Response;
  try {
    response = await fetchImpl(url, {
      headers: {
        Accept: "application/json",
      },
    });
  } catch (error) {
    return {
      candidates: [],
      diagnostics: [
        {
          provider: "tvmaze",
          status: "error",
          detail: `TVmaze request failed: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
    };
  }

  if (!response.ok) {
    return {
      candidates: [],
      diagnostics: [{ provider: "tvmaze", status: "error", detail: `TVmaze HTTP ${response.status}` }],
    };
  }

  const data = (await response.json()) as TvmazeSearchResponseItem[];
  if (!Array.isArray(data) || !data.length) {
    return {
      candidates: [],
      diagnostics: [{ provider: "tvmaze", status: "empty", detail: "TVmaze returned no series candidates" }],
    };
  }

  const requestTitle = parsed.episode?.seriesTitle ?? parsed.title;
  const candidates = data.slice(0, 5).map((result, index) => {
    const exactTitle = result.show.name.toLowerCase() === requestTitle.toLowerCase();
    const score = Math.min(97, 70 + (exactTitle ? 18 : 8) - index * 4 + Math.round(result.score * 5));
    const year = result.show.premiered?.slice(0, 4);
    const episodeBit = parsed.episode
      ? ` - S${String(parsed.episode.season).padStart(2, "0")}E${String(parsed.episode.episode).padStart(2, "0")}${parsed.episode.episodeTitle ? ` - ${parsed.episode.episodeTitle}` : ""}`
      : "";

    return {
      provider: "tvmaze",
      providerId: String(result.show.id),
      score,
      confidenceLabel: score >= 90 ? "high" : score >= 70 ? "medium" : "low",
      displayName: `${result.show.name}${year ? ` (${year})` : ""}${episodeBit}`,
      reason: exactTitle ? "Live TVmaze match by exact series title" : "Live TVmaze series candidate from search",
    } satisfies MatchCandidate;
  });

  return {
    candidates,
    diagnostics: [{ provider: "tvmaze", status: "ok", detail: `TVmaze returned ${candidates.length} candidate${candidates.length === 1 ? "" : "s"}` }],
  };
}
