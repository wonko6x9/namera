import type { MatchCandidate, ParsedMedia, PlanOptions, RenamePlan } from "@namera/core";

export function buildPlan(parsed: ParsedMedia, candidate?: MatchCandidate, options: PlanOptions = {}): RenamePlan {
  let proposedPath: string;
  const candidateName = extractCandidateTitle(candidate?.displayName) ?? parsed.title;
  const movieRoot = options.movieRoot ?? "Movies";
  const tvRoot = options.tvRoot ?? "TV Shows";
  const musicRoot = options.musicRoot ?? "Music";

  if (parsed.kind === "movie") {
    const year = extractCandidateYear(candidate?.displayName) ?? parsed.movie?.year;
    const yearSuffix = year ? ` (${year})` : "";
    const ext = parsed.extension ?? "mkv";
    proposedPath = `${movieRoot}/${candidateName}${yearSuffix}/${candidateName}${yearSuffix}.${ext}`;
  } else if (parsed.kind === "episode" && parsed.episode) {
    const ext = parsed.extension ?? "mkv";
    const season = String(parsed.episode.season).padStart(2, "0");
    const episode = String(parsed.episode.episode).padStart(2, "0");
    const seriesTitle = parsed.episode.seriesTitle ?? candidateName;
    const episodeTitle = parsed.episode.episodeTitle ? ` - ${parsed.episode.episodeTitle}` : "";
    proposedPath = `${tvRoot}/${seriesTitle}/Season ${season}/${seriesTitle} - S${season}E${episode}${episodeTitle}.${ext}`;
  } else if (parsed.kind === "music") {
    const ext = parsed.extension ?? "mp3";
    proposedPath = `${musicRoot}/${parsed.title}.${ext}`;
  } else {
    const ext = parsed.extension ?? "bin";
    proposedPath = `Unsorted/${parsed.title}.${ext}`;
  }

  const warnings: string[] = [];
  if (parsed.kind === "unknown") warnings.push("Low-confidence parse, manual review required");
  if (!candidate) warnings.push("No metadata provider candidate selected, using local heuristic only");
  if (candidate?.provider === "local-heuristic") warnings.push("Using local heuristic candidate instead of a live provider result");
  warnings.push(`Destination collision policy: ${options.collisionPolicy ?? "skip"}`);

  return {
    sourceName: parsed.rawName,
    proposedPath,
    warnings,
    confidence: candidate?.score ?? 30,
  };
}

function extractCandidateTitle(displayName?: string): string | undefined {
  if (!displayName) return undefined;
  return displayName.replace(/\s+\((?:\d{4}|\d{4}[–-]\d{4}|\d{4}-)\)$/, "").trim();
}

function extractCandidateYear(displayName?: string): number | undefined {
  if (!displayName) return undefined;
  const match = displayName.match(/\((\d{4})\)$/);
  return match ? Number(match[1]) : undefined;
}
