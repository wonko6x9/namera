import { getCorrection } from "@namera/config";
import type { MatchCandidate, ParsedMedia } from "@namera/core";

export function rankCandidates(parsed: ParsedMedia, providerCandidates: MatchCandidate[] = []): MatchCandidate[] {
  const localCandidates = buildLocalCandidates(parsed);
  const ranked = dedupeCandidates([...providerCandidates, ...localCandidates])
    .map((candidate) => ({
      ...candidate,
      confidenceLabel: labelConfidence(candidate.score),
    }))
    .sort(compareCandidates);

  return applyCorrectionPreference(parsed, ranked);
}

export function buildCorrectionKey(parsed: ParsedMedia): string {
  if (parsed.kind === "episode" && parsed.episode) {
    return [parsed.kind, parsed.episode.seriesTitle ?? parsed.title, parsed.episode.season, parsed.episode.episode]
      .map((part) => String(part).trim().toLowerCase())
      .join("|");
  }

  return [parsed.kind, parsed.title, parsed.movie?.year ?? ""]
    .map((part) => String(part).trim().toLowerCase())
    .join("|");
}

export function getCandidateKey(candidate: MatchCandidate): string {
  return `${candidate.provider}:${candidate.providerId ?? candidate.displayName}`;
}

function applyCorrectionPreference(parsed: ParsedMedia, candidates: MatchCandidate[]): MatchCandidate[] {
  const correction = getCorrection(buildCorrectionKey(parsed));
  if (!correction) {
    return candidates;
  }

  const selectedIndex = candidates.findIndex((candidate) => getCandidateKey(candidate) === correction.candidateKey);
  if (selectedIndex <= 0) {
    return candidates;
  }

  const next = [...candidates];
  const [selected] = next.splice(selectedIndex, 1);
  if (selected) {
    next.unshift({
      ...selected,
      reason: `${selected.reason} (remembered correction)`,
    });
  }
  return next;
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

function dedupeCandidates(candidates: MatchCandidate[]): MatchCandidate[] {
  const seen = new Map<string, MatchCandidate>();

  for (const candidate of candidates) {
    const key = normalizeCandidateKey(candidate.displayName);
    const current = seen.get(key);
    if (!current || compareCandidates(candidate, current) < 0) {
      seen.set(key, candidate);
    }
  }

  return Array.from(seen.values());
}

function compareCandidates(left: MatchCandidate, right: MatchCandidate): number {
  if (left.score !== right.score) {
    return right.score - left.score;
  }

  if (left.provider !== right.provider) {
    if (left.provider === "local-heuristic") return 1;
    if (right.provider === "local-heuristic") return -1;
  }

  return left.displayName.localeCompare(right.displayName);
}

function normalizeCandidateKey(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function labelConfidence(score: number): "high" | "medium" | "low" {
  if (score >= 90) return "high";
  if (score >= 70) return "medium";
  return "low";
}
