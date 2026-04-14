import type { MatchCandidate, ParsedMedia } from "@namera/core";

export function rankCandidates(parsed: ParsedMedia): MatchCandidate[] {
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
    return [
      {
        provider: "local-heuristic",
        score: 90,
        displayName: `${parsed.title} - S${String(parsed.episode.season).padStart(2, "0")}E${String(parsed.episode.episode).padStart(2, "0")}`,
        reason: "Series title and episode pattern extracted from filename",
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
