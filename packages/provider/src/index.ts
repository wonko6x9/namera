import type { MatchCandidate, ParsedMedia, ProviderConfig } from "@namera/core";

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
  if (!config.omdbApiKey) {
    return [];
  }

  if (parsed.kind !== "movie" && parsed.kind !== "episode") {
    return [];
  }

  return fetchOmdbCandidates(parsed, config.omdbApiKey, fetchImpl);
}

async function fetchOmdbCandidates(
  parsed: ParsedMedia,
  omdbApiKey: string,
  fetchImpl: typeof fetch,
): Promise<MatchCandidate[]> {
  const url = new URL("https://www.omdbapi.com/");
  url.searchParams.set("apikey", omdbApiKey);
  url.searchParams.set("s", parsed.kind === "episode" ? parsed.episode?.seriesTitle ?? parsed.title : parsed.title);

  if (parsed.kind === "movie") {
    url.searchParams.set("type", "movie");
    if (parsed.movie?.year) url.searchParams.set("y", String(parsed.movie.year));
  } else if (parsed.kind === "episode") {
    url.searchParams.set("type", "series");
  }

  const response = await fetchImpl(url, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    return [];
  }

  const data = (await response.json()) as OmdbSearchResponse;
  if (data.Response !== "True" || !data.Search?.length) {
    return [];
  }

  return data.Search.slice(0, 5).map((result, index) => {
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
    };
  });
}
