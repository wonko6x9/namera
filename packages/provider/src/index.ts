import type { MatchCandidate, ParsedMedia, ProviderConfig } from "@namera/core";

export function buildProviderRequest(parsed: ParsedMedia, config: ProviderConfig) {
  return {
    kind: parsed.kind,
    title: parsed.title,
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

export async function fetchProviderCandidates(_parsed: ParsedMedia, _config: ProviderConfig): Promise<MatchCandidate[]> {
  return [];
}
