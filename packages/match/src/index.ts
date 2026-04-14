import type { MatchCandidate, ParsedMedia } from "@namera/core";

export function rankCandidates(parsed: ParsedMedia, providerCandidates: MatchCandidate[] = []): MatchCandidate[] {
  const localCandidates = buildLocalCandidates(parsed);
  return [...providerCandidates, ...localCandidates].sort((left, right) => right.score - left.score);
}

function buildLocalCandidates(parsed: ParsedMedia): MatchCandidate[] {
  if (parsed.kind === "movie") {
    return [
      {
        provider: "local-heuristic",
        score: 92,
        displayName: parsed.movie?.year ? `${parsed.title} (${parsed.movie.year})` : parsed.title,
        reason: "Title and year extracted from filename",
      },
    ];
  }

  if (parsed.kind === "episode" && parsed.episode) {
    const seriesTitle = parsed.episode.seriesTitle ?? parsed.title;
    const episodeTitle = parsed.episode.episodeTitle ? ` - ${parsed.episode.episodeTitle}` : "";
    return [
      {
        provider: "local-heuristic",
        score: 90,
        displayName: `${seriesTitle} - S${String(parsed.episode.season).padStart(2, "0")}E${String(parsed.episode.episode).padStart(2, "0")}${episodeTitle}`,
        reason: parsed.episode.episodeTitle
          ? "Series title, episode number, and episode title extracted from filename"
          : "Series title and episode pattern extracted from filename",
      },
    ];
  }

  return [
    {
      provider: "local-heuristic",
      score: 25,
      displayName: parsed.title,
      reason: "Insufficient structure for confident match",
    },
  ];
}
