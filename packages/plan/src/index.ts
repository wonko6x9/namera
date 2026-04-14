import type { MatchCandidate, ParsedMedia, RenamePlan } from "@namera/core";

export function buildPlan(parsed: ParsedMedia, candidate?: MatchCandidate): RenamePlan {
  let proposedPath: string;

  if (parsed.kind === "movie") {
    const year = parsed.movie?.year ? ` (${parsed.movie.year})` : "";
    const ext = parsed.extension ?? "mkv";
    proposedPath = `Movies/${parsed.title}${year}/${parsed.title}${year}.${ext}`;
  } else if (parsed.kind === "episode" && parsed.episode) {
    const ext = parsed.extension ?? "mkv";
    const season = String(parsed.episode.season).padStart(2, "0");
    const episode = String(parsed.episode.episode).padStart(2, "0");
    proposedPath = `TV Shows/${parsed.title}/Season ${season}/${parsed.title} - S${season}E${episode}.${ext}`;
  } else {
    const ext = parsed.extension ?? "bin";
    proposedPath = `Unsorted/${parsed.title}.${ext}`;
  }

  const warnings: string[] = [];
  if (parsed.kind === "unknown") warnings.push("Low-confidence parse, manual review required");
  if (!candidate) warnings.push("No metadata provider candidate selected, using local heuristic only");

  return {
    sourceName: parsed.rawName,
    proposedPath,
    warnings,
    confidence: candidate?.score ?? 30,
  };
}
