import type { EpisodeInfo, MediaKind, MovieInfo, ParsedMedia } from "@namera/core";

const KNOWN_NOISE = new Set([
  "2160p",
  "1080p",
  "720p",
  "480p",
  "web",
  "webrip",
  "web-dl",
  "webdl",
  "dl",
  "bluray",
  "brrip",
  "dvdrip",
  "hdrip",
  "x264",
  "x265",
  "h264",
  "h265",
  "hevc",
  "aac",
  "ddp5",
  "ddp5.1",
  "atmos",
  "dts",
  "proper",
  "repack",
  "remux",
  "nf",
  "amzn",
  "yts",
  "rarbg",
  "unrated",
  "criterion",
  "collection",
  "directors",
  "director",
  "cut",
  "ultimate",
  "edition",
  "special",
  "imax",
  "dubbed",
  "subbed",
  "multi",
  "internal",
  "readnfo",
  "complete",
  "properly",
]);

const STOP_TOKENS = new Set(["part", "pt", "disc", "disk", "cd", "vol", "volume"]);
const EDITION_PHRASES = [
  ["final", "cut"],
  ["directors", "cut"],
  ["director", "cut"],
  ["extended", "edition"],
  ["special", "edition"],
  ["criterion", "collection"],
  ["ultimate", "edition"],
];
const QUALIFIER_TOKENS = new Set([
  "sdh",
  "cc",
  "sub",
  "subs",
  "dub",
  "dubbed",
  "forced",
  "default",
  "signs",
  "commentary",
  "hearingimpaired",
  "hi",
]);
const SIDECARExtENSIONS = new Set(["srt", "ass", "ssa", "vtt", "sub", "idx"]);
const AUDIO_EXTENSIONS = new Set(["mp3", "flac", "wav", "m4a", "aac", "ogg"]);
const LANGUAGE_TAG_PATTERN = /^[a-z]{2,3}(?:-[a-z]{2,4})?$/i;

export function parseFilename(input: string): ParsedMedia {
  const [baseName, extension] = splitExtension(input);
  const normalizedName = normalizeSeparators(baseName);
  const tokens = normalizedName.split(/\s+/).filter(Boolean);
  const episode = detectEpisode(tokens, extension);
  const year = detectYear(tokens);
  const noiseTokens = tokens.filter((token) => isNoiseToken(token));
  const titleTokens = extractTitleTokens(tokens, year, episode);
  const qualifierSuffix = extractQualifierSuffix(tokens, extension, year, episode);

  let kind: MediaKind = "unknown";
  if (episode) kind = "episode";
  else if (extension && AUDIO_EXTENSIONS.has(extension)) kind = "music";
  else if (year) kind = "movie";

  const title = cleanupTitle(titleTokens.join(" "));
  const movie: MovieInfo | undefined = year ? { year } : undefined;

  return {
    rawName: input,
    extension,
    normalizedName,
    title,
    kind,
    movie,
    episode,
    noiseTokens,
    tokens,
    qualifierSuffix,
  };
}

function splitExtension(input: string): [string, string | undefined] {
  const parts = input.split(".");
  if (parts.length < 2) return [input, undefined];
  const extension = parts.pop();
  return [parts.join("."), extension?.toLowerCase()];
}

function normalizeSeparators(input: string): string {
  return input
    .replace(/([([{])+/g, " ")
    .replace(/([\])}])+/g, " ")
    .replace(/[._\-+,]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function detectEpisode(tokens: string[], extension?: string): EpisodeInfo | undefined {
  const explicitMarkers = tokens
    .map((candidate, index) => ({ candidate, index }))
    .filter(({ candidate }) => /^S\d{2}E\d{2}(?:E\d{2})*$/i.test(candidate));

  if (!explicitMarkers.length) return undefined;

  const firstMarker = explicitMarkers[0]!;
  const token = firstMarker.candidate;
  const episodes = Array.from(token.matchAll(/E(\d{2})/gi)).map((match) => Number(match[1]));
  const primaryEpisode = episodes[0];
  if (!primaryEpisode) return undefined;

  const seriesTokens = tokens.slice(0, firstMarker.index).filter((candidate) => !isNoiseToken(candidate));
  const episodeTitleTokens = trimTrailingQualifierTokens(
    tokens
    .slice(firstMarker.index + 1)
    .filter((candidate, index, list) => !isNoiseToken(candidate))
    .filter((candidate, index, list) => !looksLikePartOrDiscTail(candidate, index, list)),
    extension,
  );

  return {
    season: Number(token.slice(1, 3)),
    episode: primaryEpisode,
    seriesTitle: cleanupTitle(seriesTokens.join(" ")) || undefined,
    episodeTitle: cleanupTitle(episodeTitleTokens.join(" ")) || undefined,
  };
}

function detectYear(tokens: string[]): number | undefined {
  return tokens
    .map((token) => Number(token))
    .find((year) => Number.isInteger(year) && year >= 1900 && year <= 2099);
}

function extractTitleTokens(tokens: string[], year?: number, episode?: EpisodeInfo): string[] {
  const episodeMarkerIndex = tokens.findIndex((token) => /^S\d{2}E\d{2}(?:E\d{2})*$/i.test(token));
  const sourceTokens = episodeMarkerIndex >= 0 ? tokens.slice(0, episodeMarkerIndex) : tokens;
  const result: string[] = [];

  for (let index = 0; index < sourceTokens.length; index += 1) {
    const token = sourceTokens[index]!;
    const lower = token.toLowerCase();

    if (isNoiseToken(token) || looksLikeExtension(token) || isEpisodeToken(token)) {
      continue;
    }

    if (year && token === String(year)) {
      break;
    }

    if (STOP_TOKENS.has(lower)) {
      const next = sourceTokens[index + 1];
      if (next && /^\d+$/i.test(next)) {
        break;
      }
    }

    if (startsEditionPhrase(sourceTokens, index)) {
      result.push(...collectEditionPhrase(sourceTokens, index));
      index += collectEditionPhrase(sourceTokens, index).length - 1;
      continue;
    }

    if (/^(part|pt|disc|disk|cd|vol|volume)\d+$/i.test(token)) {
      break;
    }

    result.push(token);
  }

  if (episode?.seriesTitle) {
    return episode.seriesTitle.split(/\s+/).filter(Boolean);
  }

  return result;
}

function looksLikePartOrDiscTail(token: string, index: number, tokens: string[]): boolean {
  if (/^(part|pt|disc|disk|cd|vol|volume)$/i.test(token)) {
    const next = tokens[index + 1];
    return Boolean(next && /^\d+$/i.test(next));
  }
  if (/^\d+$/i.test(token)) {
    const previous = tokens[index - 1];
    return Boolean(previous && /^(part|pt|disc|disk|cd|vol|volume)$/i.test(previous));
  }
  return false;
}

function startsEditionPhrase(tokens: string[], index: number): boolean {
  return EDITION_PHRASES.some((phrase) =>
    phrase.every((part, phraseIndex) => tokens[index + phraseIndex]?.toLowerCase() === part),
  );
}

function collectEditionPhrase(tokens: string[], index: number): string[] {
  const phrase = EDITION_PHRASES.find((candidate) =>
    candidate.every((part, phraseIndex) => tokens[index + phraseIndex]?.toLowerCase() === part),
  );
  return phrase ? tokens.slice(index, index + phrase.length) : [tokens[index]!];
}

function isNoiseToken(token: string): boolean {
  return KNOWN_NOISE.has(token.toLowerCase());
}

function looksLikeExtension(token: string): boolean {
  return ["mkv", "mp4", "avi", "mov", "m4v", "mp3", "flac", "wav"].includes(token.toLowerCase());
}

function isEpisodeToken(token: string): boolean {
  return /^S\d{2}E\d{2}(?:E\d{2})*$/i.test(token);
}

function cleanupTitle(title: string): string {
  return title
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => {
      if (/^(ii|iii|iv|vi|vii|viii|ix|x)$/i.test(token)) {
        return token.toUpperCase();
      }
      return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
    })
    .join(" ");
}

function extractQualifierSuffix(
  tokens: string[],
  extension?: string,
  year?: number,
  episode?: EpisodeInfo,
): string | undefined {
  if (!extension || !SIDECARExtENSIONS.has(extension.toLowerCase())) {
    return undefined;
  }

  const titleBoundary = getTitleBoundaryIndex(tokens, year, episode);
  const qualifiers: string[] = [];

  for (let index = tokens.length - 1; index >= titleBoundary; index -= 1) {
    const token = tokens[index]!;
    if (isQualifierToken(token)) {
      qualifiers.unshift(normalizeQualifierToken(token));
      continue;
    }
    if (qualifiers.length > 0) {
      break;
    }
  }

  return qualifiers.length ? `.${qualifiers.join(".")}` : undefined;
}

function getTitleBoundaryIndex(tokens: string[], year?: number, episode?: EpisodeInfo): number {
  const episodeMarkerIndex = tokens.findIndex((token) => /^S\d{2}E\d{2}(?:E\d{2})*$/i.test(token));
  if (episodeMarkerIndex >= 0) {
    let boundary = episodeMarkerIndex + 1;
    const titleTokenCount = episode?.episodeTitle?.split(/\s+/).filter(Boolean).length ?? 0;
    boundary += titleTokenCount;
    return Math.min(boundary, tokens.length);
  }

  if (year) {
    const yearIndex = tokens.findIndex((token) => token === String(year));
    if (yearIndex >= 0) {
      return yearIndex + 1;
    }
  }

  return tokens.length;
}

function isQualifierToken(token: string): boolean {
  const lower = token.toLowerCase();
  return QUALIFIER_TOKENS.has(lower) || LANGUAGE_TAG_PATTERN.test(lower);
}

function normalizeQualifierToken(token: string): string {
  return token.toLowerCase();
}

function trimTrailingQualifierTokens(tokens: string[], extension?: string): string[] {
  if (!extension || !SIDECARExtENSIONS.has(extension.toLowerCase())) {
    return tokens;
  }

  const trimmed = [...tokens];
  while (trimmed.length && isQualifierToken(trimmed[trimmed.length - 1]!)) {
    trimmed.pop();
  }
  return trimmed;
}
